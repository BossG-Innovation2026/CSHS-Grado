"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { parseFinalGrade } from "@/lib/grades";
import type { SessionUser } from "@/lib/session";
import { writeAudit, type Tx } from "@/server/audit";
import { canEnterGrades, editBlock, findRoster, findSubjectContext, type SubjectContext } from "@/server/grades";
import { userWithModule } from "@/server/guards";
import { cell, chunk, readFirstSheet } from "@/server/spreadsheet";

const { classSubject, finalGrade, gradeSubmission } = schema;

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
  /** Specific learners or rows to fix. */
  problems?: string[];
}

export interface GradeEntry {
  studentId: string;
  value: string;
}

interface Sheet {
  user: SessionUser;
  context: SubjectContext;
  tx: Tx;
}

const MAX_ENTRIES = 2000;

/** Run a change while holding this subject's row, so saves and submission cannot interleave. */
async function withEditableSheet(
  classSubjectId: string,
  work: (sheet: Sheet) => Promise<ActionState>
): Promise<ActionState> {
  const user = await userWithModule("grades_submit");
  if (!user) return { error: "You are not signed in or do not have access to Grade Submission." };

  const result = await getDb().transaction(async (tx) => {
    await tx.select({ id: classSubject.id }).from(classSubject).where(eq(classSubject.id, classSubjectId)).for("update");
    const context = await findSubjectContext(classSubjectId, tx);
    if (!context || !canEnterGrades(user, context)) return { error: "You can only enter grades for subjects you teach." };
    const blocked = editBlock(context);
    if (blocked) return { error: blocked };
    return work({ user, context, tx });
  });

  if (!result.error && !result.problems) {
    revalidatePath(`/grades/${classSubjectId}`);
    revalidatePath("/grades");
  }
  return result;
}

/** Validate and store grade changes. Writes nothing if any entry is invalid. */
async function applyGrades(
  { user, context, tx }: Sheet,
  entries: GradeEntry[],
  source: "grid" | "excel"
): Promise<ActionState> {
  const roster = await findRoster(context.classId, tx);
  const learners = new Map(roster.map((s) => [s.id, s]));

  const problems: string[] = [];
  const parsed = entries.flatMap((entry) => {
    const learner = learners.get(entry.studentId);
    if (!learner) {
      problems.push("A grade refers to a learner who is no longer in this class. Reload and try again.");
      return [];
    }
    const result = parseFinalGrade(entry.value);
    if (result.kind === "invalid") {
      problems.push(`${learner.surname}, ${learner.firstname}: ${result.reason}`);
      return [];
    }
    return [{ studentId: entry.studentId, result }];
  });
  if (problems.length > 0) return { error: "Nothing was saved. Fix these first.", problems: [...new Set(problems)].slice(0, 20) };

  const existing = await tx
    .select({ studentId: finalGrade.studentId, grade: finalGrade.grade })
    .from(finalGrade)
    .where(eq(finalGrade.classSubjectId, context.id));
  const previous = new Map(existing.map((g) => [g.studentId, g.grade]));

  const now = new Date();
  const upserts: (typeof finalGrade.$inferInsert)[] = [];
  const blanks: string[] = [];
  const changes: (string | number | null)[][] = [];

  for (const { studentId, result } of parsed) {
    const before = previous.get(studentId) ?? null;
    const after = result.kind === "grade" ? result.value : null;
    if (before === after) continue;
    changes.push([studentId, before, after]);
    if (result.kind === "grade") {
      upserts.push({ classSubjectId: context.id, studentId, grade: result.value, updatedBy: user.id, updatedAt: now });
    } else {
      blanks.push(studentId);
    }
  }
  if (changes.length === 0) return { ok: true, message: "No changes to save." };

  for (const part of chunk(upserts, 500)) {
    await tx
      .insert(finalGrade)
      .values(part)
      .onConflictDoUpdate({
        target: [finalGrade.classSubjectId, finalGrade.studentId],
        set: {
          grade: sql`excluded.grade`,
          updatedBy: sql`excluded.updated_by`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  if (blanks.length > 0) {
    await tx.delete(finalGrade).where(and(eq(finalGrade.classSubjectId, context.id), inArray(finalGrade.studentId, blanks)));
  }

  await writeAudit(tx, {
    actorId: user.id,
    action: "final_grades.save",
    entity: "class_subject",
    entityId: context.id,
    detail: { source, changes },
  });
  return { ok: true, message: `Saved ${changes.length} change(s).` };
}

/** Server Actions are public endpoints, so the shape is checked here too. */
export async function saveFinalGrades(classSubjectId: string, entries: GradeEntry[]): Promise<ActionState> {
  if (
    !Array.isArray(entries) ||
    entries.length > MAX_ENTRIES ||
    !entries.every((e) => typeof e?.studentId === "string" && typeof e?.value === "string")
  ) {
    return { error: "These grades could not be read. Reload and try again." };
  }
  return withEditableSheet(classSubjectId, (sheet) => applyGrades(sheet, entries, "grid"));
}

export async function uploadFinalGrades(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an Excel file to upload." };
  const sheet = await readFirstSheet(file);
  if ("error" in sheet) return { error: sheet.error };

  return withEditableSheet(classSubjectId, async (ready) => {
    const roster = await findRoster(ready.context.classId, ready.tx);
    const byLrn = new Map(roster.map((s) => [s.lrn, s]));

    const problems: string[] = [];
    const entries: GradeEntry[] = [];
    for (const row of sheet.rows) {
      const lrn = cell(row, "LRN");
      const learner = byLrn.get(lrn);
      if (!learner) {
        problems.push(`LRN ${lrn || "(blank)"} is not enrolled in this class.`);
        continue;
      }
      const value = cell(row, "Final Grade");
      // A blank cell leaves the saved grade alone, so a partial file cannot erase work.
      if (value) entries.push({ studentId: learner.id, value });
    }
    if (problems.length > 0) return { error: "Nothing was saved. Fix these first.", problems: problems.slice(0, 20) };
    return applyGrades(ready, entries, "excel");
  });
}

export async function submitFinalGrades(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classSubjectId = String(formData.get("classSubjectId") ?? "");
  return withEditableSheet(classSubjectId, async ({ user, context, tx }) => {
    const roster = await findRoster(context.classId, tx);
    if (roster.length === 0) return { error: "No learners are enrolled in this class yet." };

    const saved = await tx
      .select({ studentId: finalGrade.studentId })
      .from(finalGrade)
      .where(eq(finalGrade.classSubjectId, classSubjectId));
    const graded = new Set(saved.map((g) => g.studentId));
    const missing = roster.filter((s) => !graded.has(s.id));
    if (missing.length > 0) {
      return {
        error: `${missing.length} learner(s) have no saved final grade.`,
        problems: missing.slice(0, 20).map((s) => `${s.surname}, ${s.firstname}`),
      };
    }

    const submission = { status: "submitted", submittedBy: user.id, submittedAt: new Date(), returnNote: null };
    await tx
      .insert(gradeSubmission)
      .values({ classSubjectId, ...submission })
      .onConflictDoUpdate({ target: gradeSubmission.classSubjectId, set: submission });

    await writeAudit(tx, {
      actorId: user.id,
      action: "final_grades.submit",
      entity: "class_subject",
      entityId: classSubjectId,
      detail: { learners: roster.length },
    });
    return { ok: true };
  });
}
