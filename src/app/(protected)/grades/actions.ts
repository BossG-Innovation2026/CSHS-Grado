"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import {
  computeFinalGrade,
  isValidComponent,
  isValidGrade,
  type GradeComponents,
} from "@/lib/grades";
import { findSheet } from "@/server/grades";
import { recordAudit } from "@/server/audit";
import { notifyUsers, usersWithRoles } from "@/server/notifications";
import { userWithModule } from "@/server/guards";

const { grade, gradeSubmission, classSubject, signedSheet } = schema;

export interface GradeActionState {
  error?: string;
  message?: string;
  ok?: boolean;
}

function refresh(classSubjectId: string) {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/grades");
  revalidatePath(`/grades/${classSubjectId}`);
  revalidatePath("/grades/verify");
  revalidatePath("/registrar");
  revalidatePath("/audit");
}

function sheetTitle(offering: { className: string; code: string; term: number }) {
  return `${offering.className} · ${offering.code} · Term ${offering.term}`;
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
 * Written Work / Performance Task / Other components are optional; when all
 * three are present the final grade is computed from the offering's weights.
 */
export async function saveGrades(_prev: GradeActionState, formData: FormData): Promise<GradeActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const intent = formData.get("intent") === "submit" ? "submit" : "save";
  const auth = await forEncoding(classSubjectId);
  if ("error" in auth) return { error: auth.error };
  const { actor, sheet } = auth;

  const weights = {
    writtenWork: sheet.offering.wwWeight,
    performanceTask: sheet.offering.ptWeight,
    otherAssessment: sheet.offering.otherWeight,
  };

  interface Entry {
    value: number | null;
    components: GradeComponents;
  }
  const values = new Map<string, Entry>();

  function parseComponent(raw: FormDataEntryValue | null): number | null | "invalid" {
    if (raw === null) return null;
    const text = String(raw).trim();
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) && isValidComponent(value) ? value : "invalid";
  }

  for (const student of sheet.students) {
    const name = `${student.surname}, ${student.firstname}`;
    const writtenWork = parseComponent(formData.get(`ww_${student.id}`));
    const performanceTask = parseComponent(formData.get(`pt_${student.id}`));
    const otherAssessment = parseComponent(formData.get(`other_${student.id}`));
    if (writtenWork === "invalid") {
      return { error: `Written Works for ${name} must be a whole number from 0 to 100.` };
    }
    if (performanceTask === "invalid") {
      return { error: `Performance Tasks for ${name} must be a whole number from 0 to 100.` };
    }
    if (otherAssessment === "invalid") {
      return { error: `Other Components for ${name} must be a whole number from 0 to 100.` };
    }

    const components: GradeComponents = { writtenWork, performanceTask, otherAssessment };
    const computed = computeFinalGrade(components, weights);

    let value = computed;
    const raw = formData.get(`grade_${student.id}`);
    if (value === null && raw !== null) {
      const text = String(raw).trim();
      if (text) {
        const parsed = Number(text);
        if (!Number.isFinite(parsed) || !isValidGrade(parsed)) {
          return { error: `Grade for ${name} must be a whole number from 60 to 100.` };
        }
        value = parsed;
      }
    }

    values.set(student.id, { value, components });
  }

  if (intent === "submit") {
    const missing = sheet.students.filter((s) => values.get(s.id)?.value === null || values.get(s.id)?.value === undefined);
    if (missing.length > 0) {
      return {
        error: `Encode all students before submitting. ${missing.length} student(s) still have no final grade.`,
      };
    }
  }

  const now = new Date();
  await getDb().transaction(async (tx) => {
    const rows = [...values.entries()].map(([studentId, entry]) => ({
      id: randomUUID(),
      classSubjectId,
      studentId,
      value: entry.value,
      writtenWork: entry.components.writtenWork,
      performanceTask: entry.components.performanceTask,
      otherAssessment: entry.components.otherAssessment,
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
            writtenWork: sql`excluded.written_work`,
            performanceTask: sql`excluded.performance_task`,
            otherAssessment: sql`excluded.other_assessment`,
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
    sheetTitle(sheet.offering)
  );
  if (intent === "submit" && sheet.offering.adviserId !== actor.id) {
    await notifyUsers([sheet.offering.adviserId], {
      title: `Grades submitted: ${sheet.offering.code}`,
      body: `${actor.name} submitted ${sheetTitle(sheet.offering)} for verification.`,
      type: "info",
    });
  }
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

  await recordAudit(actor, "grades.verify", "class_subject", classSubjectId, sheetTitle(sheet.offering));
  const registrars = (await usersWithRoles(["registrar", "system_admin"])).filter((id) => id !== actor.id);
  await notifyUsers([sheet.offering.teacherId, ...registrars], {
    title: `Grades verified: ${sheet.offering.code}`,
    body: `${actor.name} verified ${sheetTitle(sheet.offering)}. It is ready for registrar approval.`,
    type: "info",
  });
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

  await recordAudit(actor, "grades.approve", "class_subject", classSubjectId, sheetTitle(sheet.offering));
  await notifyUsers(
    [sheet.offering.teacherId, sheet.offering.adviserId].filter((id) => id !== actor.id),
    {
      title: `Grades approved: ${sheet.offering.code}`,
      body: `The registrar approved ${sheetTitle(sheet.offering)}. The grades are locked.`,
      type: "success",
    }
  );
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
  await notifyUsers(
    [sheet.offering.teacherId, sheet.offering.adviserId].filter((id) => id !== actor.id),
    {
      title: `Grades returned: ${sheet.offering.code}`,
      body: `${sheetTitle(sheet.offering)} was returned for correction: ${note.slice(0, 280)}`,
      type: "warning",
    }
  );
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
