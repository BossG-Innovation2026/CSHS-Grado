"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { isValidGrade } from "@/lib/grades";
import { findSheet } from "@/server/grades";
import { recordAudit } from "@/server/audit";
import { userWithModule } from "@/server/guards";

const { grade, gradeSubmission, classSubject, signedSheet } = schema;

export interface GradeActionState {
  error?: string;
  message?: string;
  ok?: boolean;
}

function refresh(classSubjectId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/grades");
  revalidatePath(`/grades/${classSubjectId}`);
  revalidatePath("/grades/verify");
  revalidatePath("/registrar");
  revalidatePath("/audit");
}

/** Load a sheet and confirm the caller is allowed to encode it right now. */
async function forEncoding(classSubjectId: string) {
  const actor = await userWithModule("grades_submit");
  if (!actor) return { error: "You are not signed in or cannot submit grades." as const };
  const sheet = await findSheet(actor, classSubjectId);
  if (!sheet) return { error: "Subject not found." as const };
  if (!sheet.canEncode) {
    return { error: "This sheet is locked. It can only be edited while it is a draft or after it is returned." as const };
  }
  return { actor, sheet };
}

/**
 * Save entered grades, optionally submitting the sheet. One grade per student
 * per subject offering (a class_subject is already one subject and one term).
 */
export async function saveGrades(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const intent = formData.get("intent") === "submit" ? "submit" : "save";
  const auth = await forEncoding(classSubjectId);
  if ("error" in auth) return { error: auth.error };
  const { actor, sheet } = auth;

  const values = new Map<string, number | null>();
  for (const student of sheet.students) {
    const raw = formData.get(`grade_${student.id}`);
    if (raw === null) continue;
    const text = String(raw).trim();
    if (!text) {
      values.set(student.id, null);
      continue;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || !isValidGrade(value)) {
      return { error: `Grade for ${student.surname}, ${student.firstname} must be a whole number from 60 to 100.` };
    }
    values.set(student.id, value);
  }

  if (intent === "submit") {
    const missing = sheet.students.filter((s) => values.get(s.id) === null || values.get(s.id) === undefined);
    if (missing.length > 0) {
      return { error: `Encode all students before submitting. ${missing.length} student(s) still have no grade.` };
    }
  }

  const now = new Date();
  await getDb().transaction(async (tx) => {
    const rows = [...values.entries()].map(([studentId, value]) => ({
      id: randomUUID(),
      classSubjectId,
      studentId,
      value,
      updatedBy: actor.id,
      updatedAt: now,
    }));
    if (rows.length > 0) {
      await tx
        .insert(grade)
        .values(rows)
        .onConflictDoUpdate({
          target: [grade.classSubjectId, grade.studentId],
          set: {
            value: sql`excluded.value`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    const [existing] = await tx
      .select()
      .from(gradeSubmission)
      .where(eq(gradeSubmission.classSubjectId, classSubjectId))
      .limit(1);

    if (existing) {
      await tx
        .update(gradeSubmission)
        .set(
          intent === "submit"
            ? {
                status: "submitted",
                submittedBy: actor.id,
                submittedAt: now,
                adviserVerifiedBy: null,
                adviserVerifiedAt: null,
                registrarVerifiedBy: null,
                registrarVerifiedAt: null,
                approvedBy: null,
                approvedAt: null,
                returnNote: "",
                updatedAt: now,
              }
            : {
                status: existing.status === "returned" ? "draft" : existing.status,
                updatedAt: now,
              }
        )
        .where(eq(gradeSubmission.classSubjectId, classSubjectId));
    } else {
      await tx.insert(gradeSubmission).values({
        id: randomUUID(),
        classSubjectId,
        status: intent === "submit" ? "submitted" : "draft",
        submittedBy: intent === "submit" ? actor.id : null,
        submittedAt: intent === "submit" ? now : null,
        updatedAt: now,
      });
    }
  });

  await recordAudit(
    actor,
    intent === "submit" ? "grades.submit" : "grades.save",
    "class_subject",
    classSubjectId,
    `${sheet.offering.className} · ${sheet.offering.code} · Term ${sheet.offering.term}`
  );
  refresh(classSubjectId);
  return {
    ok: true,
    message: intent === "submit" ? "Grades submitted for verification." : "Grades saved.",
  };
}

/** Adviser or head confirms the grades are correct. */
export async function verifyGrades(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const actor = await userWithModule("grades_approve");
  if (!actor) return { error: "You cannot verify grades." };
  const sheet = await findSheet(actor, classSubjectId);
  if (!sheet) return { error: "Subject not found." };
  if (!sheet.canVerify) return { error: "This sheet is not waiting for verification." };

  const now = new Date();
  await getDb()
    .update(gradeSubmission)
    .set({
      status: "verified",
      adviserVerifiedBy: actor.id,
      adviserVerifiedAt: now,
      returnNote: "",
      updatedAt: now,
    })
    .where(eq(gradeSubmission.classSubjectId, classSubjectId));

  await recordAudit(actor, "grades.verify", "class_subject", classSubjectId, `${sheet.offering.className} · ${sheet.offering.code}`);
  refresh(classSubjectId);
  return { ok: true, message: "Grades verified. The registrar can now approve them." };
}

/** Registrar approves the verified record. */
export async function approveGrades(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const actor = await userWithModule("grades_approve");
  if (!actor) return { error: "You cannot approve grades." };
  const sheet = await findSheet(actor, classSubjectId);
  if (!sheet) return { error: "Subject not found." };
  if (!sheet.canApprove) return { error: "This sheet is not waiting for registrar approval." };

  const now = new Date();
  await getDb()
    .update(gradeSubmission)
    .set({
      status: "approved",
      registrarVerifiedBy: actor.id,
      registrarVerifiedAt: now,
      approvedBy: actor.id,
      approvedAt: now,
      returnNote: "",
      updatedAt: now,
    })
    .where(eq(gradeSubmission.classSubjectId, classSubjectId));

  await recordAudit(actor, "grades.approve", "class_subject", classSubjectId, `${sheet.offering.className} · ${sheet.offering.code}`);
  refresh(classSubjectId);
  return { ok: true, message: "Grades approved and locked." };
}

/** Send a sheet back to the encoder with a note. */
export async function returnGrades(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const actor = await userWithModule("grades_approve");
  if (!actor) return { error: "You cannot return grades." };
  const sheet = await findSheet(actor, classSubjectId);
  if (!sheet) return { error: "Subject not found." };
  if (sheet.offering.status !== "submitted" && sheet.offering.status !== "verified") {
    return { error: "Only submitted or verified sheets can be returned." };
  }
  if (!note) return { error: "Write a note so the teacher knows what to correct." };

  await getDb()
    .update(gradeSubmission)
    .set({
      status: "returned",
      returnNote: note.slice(0, 500),
      adviserVerifiedBy: null,
      adviserVerifiedAt: null,
      registrarVerifiedBy: null,
      registrarVerifiedAt: null,
      approvedBy: null,
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(gradeSubmission.classSubjectId, classSubjectId));

  await recordAudit(actor, "grades.return", "class_subject", classSubjectId, note);
  refresh(classSubjectId);
  return { ok: true, message: "Sheet returned to the teacher." };
}

/** Registrar records the signed paper grading sheet received from the teacher. */
export async function recordSignedSheet(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const actor = await userWithModule("registrar");
  if (!actor) return { error: "Only the registrar office can record signed sheets." };
  const [offering] = await getDb()
    .select({ id: classSubject.id })
    .from(classSubject)
    .where(eq(classSubject.id, classSubjectId))
    .limit(1);
  if (!offering) return { error: "Subject not found." };

  await getDb().insert(signedSheet).values({
    id: randomUUID(),
    classSubjectId,
    referenceNo: String(formData.get("referenceNo") ?? "").trim().slice(0, 80),
    receivedBy: actor.id,
    note: String(formData.get("note") ?? "").trim().slice(0, 300),
    receivedAt: new Date(),
  });

  await recordAudit(actor, "signed_sheet.receive", "class_subject", classSubjectId);
  refresh(classSubjectId);
  return { ok: true, message: "Signed sheet recorded." };
}
