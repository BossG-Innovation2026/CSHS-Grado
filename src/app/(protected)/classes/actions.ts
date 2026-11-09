"use server";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { TERMS, type Term } from "@/lib/terms";
import { isAdmin } from "@/lib/modules";
import { findCurrentSchoolYear } from "@/server/school-years";
import type { SessionUser } from "@/lib/session";
import { checkOwnPassword, userWithModule } from "@/server/guards";
import { canManageClass, findClass } from "@/server/classes";
import { classHasGrades, studentHasGrades, subjectHasGrades } from "@/server/grades";
import { cell, chunk, readFirstSheet } from "@/server/spreadsheet";

const { schoolClass, classSubject, gradeLevel, subject, student, enrollment } = schema;

export interface ActionState {
  error?: string;
  message?: string;
  needsConfirm?: boolean;
  ok?: boolean;
}

const NO_ACCESS: ActionState = { error: "You are not signed in or do not have access to Classes." };
const NOT_ADVISER: ActionState = { error: "You can only manage classes you advise." };

/** Signed in + module access + manages the class + re-entered password. */
async function authorizeClassChange(
  formData: FormData,
  classId: string
): Promise<{ user: SessionUser } | { error: string }> {
  const user = await userWithModule("classes");
  if (!user) return { error: NO_ACCESS.error! };
  if (!(await canManageClass(user, classId))) return { error: NOT_ADVISER.error! };
  const passwordError = await checkOwnPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };
  return { user };
}

async function classIdOfSubject(classSubjectId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ classId: classSubject.classId })
    .from(classSubject)
    .where(eq(classSubject.id, classSubjectId))
    .limit(1);
  return row?.classId;
}

function nextSectionName(gradeLevelName: string, existing: number): string {
  return `${gradeLevelName} - ${String.fromCharCode(65 + existing)}`; // A, B, C...
}

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await userWithModule("classes");
  if (!user) return NO_ACCESS;

  const db = getDb();
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const [level] = await db
    .select({ id: gradeLevel.id, name: gradeLevel.name })
    .from(gradeLevel)
    .where(eq(gradeLevel.id, gradeLevelId))
    .limit(1);
  if (!level) return { error: "Choose a grade level." };
  const year = await findCurrentSchoolYear();

  let name = String(formData.get("name") ?? "").trim();
  if (!name) {
    const [{ existing }] = await db
      .select({ existing: count() })
      .from(schoolClass)
      .where(and(eq(schoolClass.schoolYearId, year.id), eq(schoolClass.gradeLevelId, gradeLevelId)));
    name = nextSectionName(level.name, Number(existing));
  }

  const confirming = formData.get("confirm") === "1";
  if (!confirming) {
    const [advisory] = await db
      .select({ name: schoolClass.name })
      .from(schoolClass)
      .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
      .where(
        and(
          eq(schoolClass.schoolYearId, year.id),
          eq(schoolClass.adviserId, user.id),
          ne(schoolClass.gradeLevelId, gradeLevelId)
        )
      )
      .orderBy(asc(gradeLevel.sortOrder))
      .limit(1);
    if (advisory) {
      return {
        error: `You already advise a class (${advisory.name}). Creating this class will make you adviser of two classes.`,
        needsConfirm: true,
      };
    }
  }

  const classId = randomUUID();
  const inserted = await db
    .insert(schoolClass)
    .values({
      id: classId,
      name,
      gradeLevelId,
      adviserId: user.id,
      schoolYearId: year.id,
    })
    // No target: two unique indexes on section names exist until the older one is dropped.
    .onConflictDoNothing()
    .returning({ id: schoolClass.id });
  if (inserted.length === 0) return { error: `${level.name} - ${name} already exists.` };

  revalidatePath("/classes");
  redirect(`/classes/${classId}`);
}

export async function setSubjectTeacher(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "") || null;

  const classId = await classIdOfSubject(classSubjectId);
  if (!classId) return { error: "Subject not found." };
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  await getDb().update(classSubject).set({ teacherId }).where(eq(classSubject.id, classSubjectId));
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function addClassSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const cls = await findClass(classId);
  if (!cls) return { error: "Class not found." };
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  const term = Number(formData.get("term") ?? 1);
  if (!TERMS.includes(term as Term)) return { error: "Invalid term." };

  const db = getDb();
  const subjectId = String(formData.get("subjectId") ?? "");
  const [picked] = await db
    .select({ id: subject.id, code: subject.code, title: subject.title })
    .from(subject)
    .where(and(eq(subject.id, subjectId), eq(subject.gradeLevelId, cls.gradeLevelId)))
    .limit(1);
  if (!picked) return { error: "Choose a subject from this grade level's curriculum." };

  const inserted = await db
    .insert(classSubject)
    .values({
      id: randomUUID(),
      classId,
      subjectId: picked.id,
      code: picked.code,
      title: picked.title,
      description: String(formData.get("description") ?? "").trim(),
      teacherId: String(formData.get("teacherId") ?? "") || null,
      term,
    })
    .onConflictDoNothing({ target: [classSubject.classId, classSubject.code, classSubject.term] })
    .returning({ id: classSubject.id });
  if (inserted.length === 0) return { error: `${picked.code} is already in this class for Term ${term}.` };

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function removeClassSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const classId = await classIdOfSubject(id);
  if (!classId) return { error: "Subject not found." };
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;
  if (await subjectHasGrades(id)) return { error: "This subject has grades and cannot be removed." };

  await getDb().delete(classSubject).where(eq(classSubject.id, id));
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function deleteClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const auth = await authorizeClassChange(formData, id);
  if ("error" in auth) return auth;
  if (await classHasGrades(id)) {
    return { error: "This class has grades and cannot be deleted. DepEd requires keeping these records." };
  }

  await getDb().delete(schoolClass).where(eq(schoolClass.id, id));
  revalidatePath("/classes");
  redirect("/classes");
}

export async function renameClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const cls = await findClass(classId);
  if (!cls) return { error: "Class not found." };
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Section name is required." };

  const db = getDb();
  const [clash] = await db
    .select({ id: schoolClass.id })
    .from(schoolClass)
    .where(and(eq(schoolClass.gradeLevelId, cls.gradeLevelId), eq(schoolClass.name, name), ne(schoolClass.id, classId)))
    .limit(1);
  if (clash) return { error: `A class named ${name} already exists in ${cls.gradeLevelName}.` };

  await db.update(schoolClass).set({ name }).where(eq(schoolClass.id, classId));
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

/* --- Students / enrollment --- */

interface StudentInput {
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  sex: string;
}

/** DepEd Learner Reference Numbers are exactly 12 digits. */
const LRN_PATTERN = /^\d{12}$/;

function validStudent(s: StudentInput): boolean {
  return LRN_PATTERN.test(s.lrn) && Boolean(s.surname && s.firstname) && (s.sex === "M" || s.sex === "F");
}

function sameDetails(a: StudentInput, b: StudentInput): boolean {
  const same = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();
  return (
    same(a.surname, b.surname) &&
    same(a.firstname, b.firstname) &&
    same(a.middlename, b.middlename) &&
    same(a.sex, b.sex)
  );
}

/**
 * Create students by LRN and enroll them in a class, in one transaction with
 * a constant number of queries per 500 students.
 *
 * An existing student's details may be changed only by a System Admin or when
 * the student is in no other class. Anyone else submitting different details
 * for that LRN is refused (`blocked`) rather than enrolled, since a mismatch
 * usually means a mistyped LRN.
 */
async function enrollStudents(
  actor: SessionUser,
  classId: string,
  students: StudentInput[]
): Promise<{ added: number; blocked: number }> {
  let added = 0;
  let blocked = 0;
  await getDb().transaction(async (tx) => {
    for (const part of chunk(students, 500)) {
      const existing = await tx
        .select({
          id: student.id,
          lrn: student.lrn,
          surname: student.surname,
          firstname: student.firstname,
          middlename: student.middlename,
          sex: student.sex,
        })
        .from(student)
        .where(
          inArray(
            student.lrn,
            part.map((s) => s.lrn)
          )
        );
      const existingByLrn = new Map(existing.map((e) => [e.lrn, e]));
      const changedIds = part.flatMap((s) => {
        const current = existingByLrn.get(s.lrn);
        return current && !sameDetails(s, current) ? [current.id] : [];
      });

      const lockedIds = new Set<string>();
      if (changedIds.length > 0 && !isAdmin(actor)) {
        const elsewhere = await tx
          .selectDistinct({ studentId: enrollment.studentId })
          .from(enrollment)
          .where(and(inArray(enrollment.studentId, changedIds), ne(enrollment.classId, classId)));
        for (const row of elsewhere) lockedIds.add(row.studentId);
      }

      const allowed = part.filter((s) => {
        const current = existingByLrn.get(s.lrn);
        return !current || sameDetails(s, current) || !lockedIds.has(current.id);
      });
      blocked += part.length - allowed.length;
      if (allowed.length === 0) continue;

      const saved = await tx
        .insert(student)
        .values(allowed.map((s) => ({ id: randomUUID(), ...s })))
        .onConflictDoUpdate({
          target: student.lrn,
          set: {
            surname: sql`excluded.surname`,
            firstname: sql`excluded.firstname`,
            middlename: sql`excluded.middlename`,
            sex: sql`excluded.sex`,
          },
        })
        .returning({ id: student.id });
      const enrolled = await tx
        .insert(enrollment)
        .values(saved.map((s) => ({ id: randomUUID(), classId, studentId: s.id })))
        .onConflictDoNothing({ target: [enrollment.classId, enrollment.studentId] })
        .returning({ id: enrollment.id });
      added += enrolled.length;
    }
  });
  return { added, blocked };
}

export async function enrollStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  const input: StudentInput = {
    lrn: String(formData.get("lrn") ?? "").trim(),
    surname: String(formData.get("surname") ?? "").trim(),
    firstname: String(formData.get("firstname") ?? "").trim(),
    middlename: String(formData.get("middlename") ?? "").trim(),
    sex: String(formData.get("sex") ?? "").trim().toUpperCase(),
  };
  if (!LRN_PATTERN.test(input.lrn)) return { error: "LRN must be exactly 12 digits." };
  if (!input.surname || !input.firstname) return { error: "Surname and first name are required." };
  if (input.sex !== "M" && input.sex !== "F") return { error: "Sex must be M or F." };

  const { added, blocked } = await enrollStudents(auth.user, classId, [input]);
  if (blocked > 0) {
    return {
      error: `LRN ${input.lrn} belongs to a student in another class with different details. Check the LRN, or ask a System Admin to correct the record.`,
    };
  }
  if (added === 0) return { error: `Student ${input.lrn} is already enrolled in this class.` };

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

/** The example row in the downloadable template (the first value is from older downloads). */
const TEMPLATE_SAMPLE_LRNS = ["1234567890", "123456789012"];

export async function enrollFromTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an Excel file to upload." };
  const sheet = await readFirstSheet(file);
  if ("error" in sheet) return { error: sheet.error };

  let invalid = 0;
  let duplicates = 0;
  const byLrn = new Map<string, StudentInput>();
  for (const row of sheet.rows) {
    const s: StudentInput = {
      lrn: cell(row, "LRN", "lrn"),
      surname: cell(row, "Surname", "surname"),
      firstname: cell(row, "Firstname", "First name", "firstname"),
      middlename: cell(row, "Middlename", "Middle name", "middlename"),
      sex: cell(row, "Sex", "sex").toUpperCase(),
    };
    if (TEMPLATE_SAMPLE_LRNS.includes(s.lrn) && s.surname === "Doe" && s.firstname === "John") continue;
    if (!validStudent(s)) {
      invalid += 1;
      continue;
    }
    if (byLrn.has(s.lrn)) duplicates += 1;
    byLrn.set(s.lrn, s);
  }

  const { added, blocked } =
    byLrn.size > 0 ? await enrollStudents(auth.user, classId, [...byLrn.values()]) : { added: 0, blocked: 0 };
  const skipped = byLrn.size - added - blocked + duplicates;
  const conflicts = blocked > 0 ? ` Not enrolled: ${blocked} (LRN belongs to a student in another class with different details).` : "";

  revalidatePath(`/classes/${classId}`);
  return {
    ok: true,
    message: `Enrolled ${added} student(s). Skipped ${skipped} already enrolled. Invalid rows: ${invalid}.${conflicts}`,
  };
}

export async function unenrollStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const auth = await authorizeClassChange(formData, classId);
  if ("error" in auth) return auth;

  const studentId = String(formData.get("studentId") ?? "");
  if (await studentHasGrades(classId, studentId)) {
    return { error: "This learner has grades in this class and cannot be unenrolled." };
  }
  await getDb()
    .delete(enrollment)
    .where(and(eq(enrollment.classId, classId), eq(enrollment.studentId, studentId)));
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}
