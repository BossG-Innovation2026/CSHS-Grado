"use server";

import { randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { adminUser, checkOwnPassword } from "@/server/guards";
import { findGradeLevel } from "@/server/curriculum";
import { cell, chunk, readFirstSheet } from "@/server/spreadsheet";

const { gradeLevel, subject } = schema;

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export interface BulkSubjectResult {
  added: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

function revalidateCurriculum(gradeLevelId?: string) {
  revalidatePath("/curriculum");
  if (gradeLevelId) revalidatePath(`/curriculum/${gradeLevelId}`);
}

function positiveInt(raw: unknown, fallback = 1): number {
  if (raw === null || raw === undefined || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

export async function addGradeLevel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized to modify the curriculum." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Choose a grade level." };

  const db = getDb();
  const [{ maxOrder }] = await db.select({ maxOrder: max(gradeLevel.sortOrder) }).from(gradeLevel);
  const inserted = await db
    .insert(gradeLevel)
    .values({ id: randomUUID(), name, sortOrder: (maxOrder ?? 12) + 1 })
    .onConflictDoNothing({ target: gradeLevel.name })
    .returning({ id: gradeLevel.id });
  if (inserted.length === 0) return { error: `${name} already exists.` };

  revalidateCurriculum();
  return { ok: true };
}

export async function deleteGradeLevel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized to modify the curriculum." };
  const passwordError = await checkOwnPassword(actor, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const id = String(formData.get("id") ?? "");
  await getDb().delete(gradeLevel).where(eq(gradeLevel.id, id));
  revalidateCurriculum();
  redirect("/curriculum");
}

export async function addSubject(formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized to modify the curriculum." };

  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const level = await findGradeLevel(gradeLevelId);
  if (!level) return { error: "Grade level not found." };

  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const terms = positiveInt(formData.get("terms"));
  const creditUnits = positiveInt(formData.get("creditUnits"));

  if (!code) return { error: "Subject code is required." };
  if (!title) return { error: "Subject title is required." };
  if (Number.isNaN(terms)) return { error: "Number of terms must be at least 1." };
  if (Number.isNaN(creditUnits)) return { error: "Credit units must be at least 1." };

  const inserted = await getDb()
    .insert(subject)
    .values({ id: randomUUID(), gradeLevelId, code, title, terms, creditUnits })
    .onConflictDoNothing({ target: [subject.gradeLevelId, subject.code] })
    .returning({ id: subject.id });
  if (inserted.length === 0) return { error: `Subject ${code} already exists in ${level.name}.` };

  revalidateCurriculum(gradeLevelId);
  return { ok: true };
}

export async function deleteSubject(formData: FormData): Promise<void> {
  const actor = await adminUser();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  await getDb()
    .delete(subject)
    .where(and(eq(subject.id, id), eq(subject.gradeLevelId, gradeLevelId)));
  revalidateCurriculum(gradeLevelId);
}

export async function bulkAddSubjects(formData: FormData): Promise<BulkSubjectResult> {
  const fail = (message: string): BulkSubjectResult => ({ added: 0, skipped: 0, invalid: 0, errors: [message] });

  const actor = await adminUser();
  if (!actor) return fail("You are not authorized to modify the curriculum.");

  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const level = await findGradeLevel(gradeLevelId);
  if (!level) return fail("Grade level not found.");

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose an Excel file to upload.");
  const sheet = await readFirstSheet(file);
  if ("error" in sheet) return fail(sheet.error);

  let invalid = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const byCode = new Map<string, { code: string; title: string; terms: number; creditUnits: number }>();

  for (const row of sheet.rows) {
    const code = cell(row, "Code", "code");
    const title = cell(row, "Title", "title");
    const terms = positiveInt(cell(row, "Terms", "terms"));
    const creditUnits = positiveInt(cell(row, "Credit Units", "creditUnits"));

    let problem: string | null = null;
    if (!code) problem = "Row missing subject code.";
    else if (!title) problem = `Subject code ${code} is missing a title.`;
    else if (Number.isNaN(terms)) problem = `Subject code ${code} has invalid terms.`;
    else if (Number.isNaN(creditUnits)) problem = `Subject code ${code} has invalid credit units.`;
    if (problem) {
      invalid += 1;
      errors.push(problem);
      continue;
    }
    if (byCode.has(code)) duplicates += 1;
    byCode.set(code, { code, title, terms, creditUnits });
  }

  // One INSERT per 500 rows instead of two queries per row.
  let added = 0;
  const db = getDb();
  for (const part of chunk([...byCode.values()], 500)) {
    const inserted = await db
      .insert(subject)
      .values(part.map((s) => ({ id: randomUUID(), gradeLevelId, ...s })))
      .onConflictDoNothing({ target: [subject.gradeLevelId, subject.code] })
      .returning({ id: subject.id });
    added += inserted.length;
  }

  revalidateCurriculum(gradeLevelId);
  return { added, skipped: byCode.size - added + duplicates, invalid, errors };
}
