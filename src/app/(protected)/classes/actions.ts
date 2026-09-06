"use server";

import { randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryAll, queryOne, runSql } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/modules";
import { TERMS, type Term } from "@/lib/terms";
import * as XLSX from "xlsx";

export interface ActionState {
  error?: string;
  message?: string;
  needsConfirm?: boolean;
  ok?: boolean;
}

export interface ClassRow {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  adviserId: string;
  adviserName: string;
  createdAt: number;
}

export interface ClassSubjectRow {
  id: string;
  classId: string;
  subjectId: string | null;
  code: string;
  title: string;
  description: string;
  teacherId: string | null;
  teacherName: string | null;
  term: number;
  createdAt: number;
}

export interface StudentRow {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  sex: string;
  createdAt: number;
}

async function currentUser() {
  return getSessionUser();
}

async function canManageClass(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, classId: string) {
  if (isAdmin(user)) return true;
  const cls = await getClass(classId);
  return cls?.adviserId === user.id;
}

async function checkAuthPassword(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  password: string
): Promise<string | null> {
  if (!password) return "Enter your password to continue.";
  const row = await queryOne<{ password: string | null }>(
    "SELECT password FROM account WHERE userId = ? AND providerId = 'credential'",
    user.id
  );
  if (!row?.password) return "Account not found.";
  const ok = await verifyPassword({ hash: row.password, password });
  if (!ok) return "Incorrect password.";
  return null;
}

export async function listClasses(): Promise<ClassRow[]> {
  return queryAll<ClassRow>(
    `SELECT c.id, c.name, c.gradeLevelId, g.name AS gradeLevelName,
            c.adviserId, u.name AS adviserName, c.createdAt
     FROM class c
     JOIN grade_level g ON g.id = c.gradeLevelId
     JOIN user u ON u.id = c.adviserId
     ORDER BY g.sortOrder, c.name COLLATE NOCASE`
  );
}

export async function getClass(id: string): Promise<ClassRow | undefined> {
  return queryOne<ClassRow>(
    `SELECT c.id, c.name, c.gradeLevelId, g.name AS gradeLevelName,
            c.adviserId, u.name AS adviserName, c.createdAt
     FROM class c
     JOIN grade_level g ON g.id = c.gradeLevelId
     JOIN user u ON u.id = c.adviserId
     WHERE c.id = ?`,
    id
  );
}

export async function listClassSubjects(classId: string, term: number): Promise<ClassSubjectRow[]> {
  return queryAll<ClassSubjectRow>(
    `SELECT cs.id, cs.classId, cs.subjectId, cs.code, cs.title, cs.description, cs.teacherId, u.name AS teacherName, cs.term, cs.createdAt
     FROM class_subject cs
     LEFT JOIN user u ON u.id = cs.teacherId
     WHERE cs.classId = ? AND cs.term = ?
     ORDER BY cs.title COLLATE NOCASE`,
    classId,
    term
  );
}

export async function countClassSubjects(classId: string): Promise<number> {
  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM class_subject WHERE classId = ?",
    classId
  );
  return Number(row?.c ?? 0);
}

export async function listActiveTeachers(): Promise<{ id: string; name: string }[]> {
  return queryAll<{ id: string; name: string }>(
    `SELECT id, name FROM user WHERE role = 'teacher' AND active = 1
     ORDER BY name COLLATE NOCASE`
  );
}

export async function listGradeLevels(): Promise<{ id: string; name: string }[]> {
  return queryAll<{ id: string; name: string }>(
    `SELECT id, name FROM grade_level ORDER BY sortOrder`
  );
}

export async function listSubjectsByGrade(gradeLevelId: string): Promise<{ id: string; code: string; title: string }[]> {
  return queryAll<{ id: string; code: string; title: string }>(
    `SELECT id, code, title FROM subject WHERE gradeLevelId = ? ORDER BY title COLLATE NOCASE`,
    gradeLevelId
  );
}

async function countExisting(gradeLevelId: string): Promise<number> {
  const row = await queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM class WHERE gradeLevelId = ?",
    gradeLevelId
  );
  return Number(row?.c ?? 0);
}

function nextSectionName(gradeLevelName: string, count: number): string {
  const letter = String.fromCharCode(65 + count); // A, B, C...
  return `${gradeLevelName} - ${letter}`;
}

export async function createClass(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState | never> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const level = await queryOne<{ id: string; name: string }>(
    "SELECT id, name FROM grade_level WHERE id = ?",
    gradeLevelId
  );
  if (!level) return { error: "Choose a grade level." };

  const existingCount = await countExisting(gradeLevelId);
  const name = String(formData.get("name") ?? "").trim() || nextSectionName(level.name, existingCount);

  const existingClass = await queryOne<{ id: string }>(
    "SELECT id FROM class WHERE gradeLevelId = ? AND name = ?",
    gradeLevelId,
    name
  );
  if (existingClass) return { error: `${level.name} - ${name} already exists.` };

  const confirming = formData.get("confirm") === "1";
  const advisory = await queryOne<{ id: string; name: string }>(
    `SELECT c.id, c.name FROM class c
     JOIN grade_level g ON g.id = c.gradeLevelId
     WHERE c.adviserId = ? AND c.gradeLevelId != ?
     ORDER BY g.sortOrder LIMIT 1`,
    user.id,
    gradeLevelId
  );
  if (advisory && !confirming) {
    return {
      error: `You already advise a class (${advisory.name}). Creating this class will make you adviser of two classes.`,
      needsConfirm: true,
    };
  }

  const now = Date.now();
  const classId = randomUUID();
  await runSql(
    "INSERT INTO class (id, name, gradeLevelId, adviserId, createdAt) VALUES (?, ?, ?, ?, ?)",
    classId,
    name,
    gradeLevelId,
    user.id,
    now
  );

  revalidatePath("/classes");
  redirect(`/classes/${classId}`);
}

export async function setSubjectTeacher(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "") || null;

  const row = await queryOne<{ classId: string }>(
    "SELECT classId FROM class_subject WHERE id = ?",
    classSubjectId
  );
  if (!row) return { error: "Subject not found." };
  if (!(await canManageClass(user, row.classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  await runSql("UPDATE class_subject SET teacherId = ? WHERE id = ?", teacherId, classSubjectId);
  revalidatePath(`/classes/${row.classId}`);
  return { ok: true };
}

export async function addClassSubject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classId = String(formData.get("classId") ?? "");
  const cls = await getClass(classId);
  if (!cls) return { error: "Class not found." };
  if (!(await canManageClass(user, classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const term = Number(formData.get("term") ?? 1);
  if (!TERMS.includes(term as Term)) return { error: "Invalid term." };

  const subjectId = String(formData.get("subjectId") ?? "");
  const subject = await queryOne<{ id: string; code: string; title: string }>(
    "SELECT id, code, title FROM subject WHERE id = ? AND gradeLevelId = ?",
    subjectId,
    cls.gradeLevelId
  );
  if (!subject) return { error: "Choose a subject from this grade level's curriculum." };

  const description = String(formData.get("description") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "") || null;

  const clash = await queryOne<{ id: string }>(
    "SELECT id FROM class_subject WHERE classId = ? AND code = ? AND term = ?",
    classId,
    subject.code,
    term
  );
  if (clash) return { error: `${subject.code} is already in this class for Term ${term}.` };

  await runSql(
    "INSERT INTO class_subject (id, classId, subjectId, code, title, description, teacherId, term, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    classId,
    subject.id,
    subject.code,
    subject.title,
    description,
    teacherId,
    term,
    Date.now()
  );

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function removeClassSubject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const id = String(formData.get("id") ?? "");
  const row = await queryOne<{ classId: string }>("SELECT classId FROM class_subject WHERE id = ?", id);
  if (!row) return { error: "Subject not found." };
  if (!(await canManageClass(user, row.classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  await runSql("DELETE FROM class_subject WHERE id = ?", id);
  revalidatePath(`/classes/${row.classId}`);
  return { ok: true };
}

export async function deleteClass(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState | never> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const id = String(formData.get("id") ?? "");
  if (!(await canManageClass(user, id))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  await runSql("DELETE FROM class WHERE id = ?", id);
  revalidatePath("/classes");
  redirect("/classes");
}

export async function renameClass(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classId = String(formData.get("classId") ?? "");
  const cls = await getClass(classId);
  if (!cls) return { error: "Class not found." };
  if (!(await canManageClass(user, classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Section name is required." };

  const clash = await queryOne<{ id: string }>(
    "SELECT id FROM class WHERE gradeLevelId = ? AND name = ? AND id != ?",
    cls.gradeLevelId,
    name,
    classId
  );
  if (clash) return { error: `A class named ${name} already exists in ${cls.gradeLevelName}.` };

  await runSql("UPDATE class SET name = ? WHERE id = ?", name, classId);
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

// --- Students / enrollment ---

export async function listStudents(classId: string): Promise<StudentRow[]> {
  return queryAll<StudentRow>(
    `SELECT s.id, s.lrn, s.surname, s.firstname, s.middlename, s.sex, s.createdAt
     FROM enrollment e
     JOIN student s ON s.id = e.studentId
     WHERE e.classId = ?
     ORDER BY s.surname COLLATE NOCASE, s.firstname COLLATE NOCASE`,
    classId
  );
}

export async function upsertStudent(
  lrn: string,
  surname: string,
  firstname: string,
  middlename: string,
  sex: string
): Promise<string> {
  const now = Date.now();
  const existing = await queryOne<{ id: string }>("SELECT id FROM student WHERE lrn = ?", lrn);
  if (existing) {
    await runSql(
      "UPDATE student SET surname = ?, firstname = ?, middlename = ?, sex = ? WHERE id = ?",
      surname,
      firstname,
      middlename,
      sex,
      existing.id
    );
    return existing.id;
  }
  const id = randomUUID();
  await runSql(
    "INSERT INTO student (id, lrn, surname, firstname, middlename, sex, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    lrn,
    surname,
    firstname,
    middlename,
    sex,
    now
  );
  return id;
}

async function enroll(studentId: string, classId: string): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM enrollment WHERE classId = ? AND studentId = ?",
    classId,
    studentId
  );
  if (existing) return;
  await runSql(
    "INSERT INTO enrollment (id, classId, studentId, createdAt) VALUES (?, ?, ?, ?)",
    randomUUID(),
    classId,
    studentId,
    Date.now()
  );
}

export async function enrollStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classId = String(formData.get("classId") ?? "");
  if (!(await canManageClass(user, classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const lrn = String(formData.get("lrn") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const firstname = String(formData.get("firstname") ?? "").trim();
  const middlename = String(formData.get("middlename") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim().toUpperCase();

  if (!lrn) return { error: "LRN is required." };
  if (!surname || !firstname) return { error: "Surname and first name are required." };
  if (sex !== "M" && sex !== "F") return { error: "Sex must be M or F." };

  const studentId = await upsertStudent(lrn, surname, firstname, middlename, sex);
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM enrollment WHERE classId = ? AND studentId = ?",
    classId,
    studentId
  );
  if (existing) return { error: `Student ${lrn} is already enrolled in this class.` };

  await enroll(studentId, classId);
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

function parseXlsx(text: Buffer): Record<string, string>[] {
  const wb = XLSX.read(text, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
}

export async function enrollFromTemplate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classId = String(formData.get("classId") ?? "");
  if (!(await canManageClass(user, classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const file = formData.get("file");
  if (!file || typeof file === "string") return { error: "Choose an Excel file to upload." };
  const buffer = Buffer.from(await file.arrayBuffer());

  const rows = parseXlsx(buffer);
  if (rows.length === 0) return { error: "The file is empty." };

  const header = Object.keys(rows[0]);
  if (
    header.length === 5 &&
    header[0].toUpperCase() === "LRN" &&
    header[1].toUpperCase() === "SURNAME"
  ) {
    rows.shift();
  }

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  for (const row of rows) {
    const lrn = String(row["LRN"] ?? "").trim();
    const surname = String(row["Surname"] ?? "").trim();
    const firstname = String(row["Firstname"] ?? "").trim();
    const middlename = String(row["Middlename"] ?? "").trim();
    const sex = String(row["Sex"] ?? "").trim().toUpperCase();

    if (!lrn || !surname || !firstname || (sex !== "M" && sex !== "F")) {
      invalid += 1;
      continue;
    }

    const studentId = await upsertStudent(lrn, surname, firstname, middlename, sex);
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM enrollment WHERE classId = ? AND studentId = ?",
      classId,
      studentId
    );
    if (existing) {
      skipped += 1;
      continue;
    }
    await enroll(studentId, classId);
    added += 1;
  }

  revalidatePath(`/classes/${classId}`);
  return {
    ok: true,
    message: `Enrolled ${added} student(s). Skipped ${skipped} already enrolled. Invalid rows: ${invalid}.`,
  };
}

export async function unenrollStudent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "You are not signed in." };

  const classId = String(formData.get("classId") ?? "");
  if (!(await canManageClass(user, classId))) {
    return { error: "You can only manage classes you advise." };
  }

  const passwordError = await checkAuthPassword(user, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const studentId = String(formData.get("studentId") ?? "");
  await runSql("DELETE FROM enrollment WHERE classId = ? AND studentId = ?", classId, studentId);
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}
