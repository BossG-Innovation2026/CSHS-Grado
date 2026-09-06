"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { queryAll, queryOne, runSql } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/modules";
import * as XLSX from "xlsx";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export interface GradeLevelRow {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
}

export interface SubjectRow {
  id: string;
  gradeLevelId: string;
  code: string;
  title: string;
  terms: number;
  creditUnits: number;
  createdAt: number;
}

async function currentAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return null;
  return user;
}

export async function listGradeLevels(): Promise<GradeLevelRow[]> {
  return queryAll<GradeLevelRow>(
    `SELECT id, name, sortOrder, createdAt
     FROM grade_level ORDER BY sortOrder`
  );
}

export async function getGradeLevel(id: string): Promise<GradeLevelRow | undefined> {
  return queryOne<GradeLevelRow>(
    `SELECT id, name, sortOrder, createdAt FROM grade_level WHERE id = ?`,
    id
  );
}

export async function listSubjects(gradeLevelId: string): Promise<SubjectRow[]> {
  return queryAll<SubjectRow>(
    `SELECT id, gradeLevelId, code, title, terms, creditUnits, createdAt
     FROM subject WHERE gradeLevelId = ? ORDER BY title COLLATE NOCASE`,
    gradeLevelId
  );
}

export async function countSubjects(): Promise<Record<string, number>> {
  const rows = await queryAll<{ gradeLevelId: string; count: number }>(
    `SELECT gradeLevelId, COUNT(*) AS count FROM subject GROUP BY gradeLevelId`
  );
  return Object.fromEntries(rows.map((r) => [r.gradeLevelId, Number(r.count)]));
}

export async function addGradeLevel(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await currentAdmin();
  if (!actor) return { error: "You are not authorized to modify the curriculum." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Choose a grade level." };

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM grade_level WHERE name = ?",
    name
  );
  if (existing) return { error: `${name} already exists.` };

  const maxOrder = await queryOne<{ max: number }>(
    "SELECT MAX(sortOrder) AS max FROM grade_level"
  );

  await runSql(
    "INSERT INTO grade_level (id, name, sortOrder, createdAt) VALUES (?, ?, ?, ?)",
    randomUUID(),
    name,
    (maxOrder?.max ?? 12) + 1,
    Date.now()
  );

  revalidatePath("/curriculum");
  return { ok: true };
}

export async function deleteGradeLevel(formData: FormData): Promise<void> {
  const actor = await currentAdmin();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  await runSql("DELETE FROM grade_level WHERE id = ?", id);

  revalidatePath("/curriculum");
}

export async function addSubject(formData: FormData): Promise<ActionState> {
  const actor = await currentAdmin();
  if (!actor) return { error: "You are not authorized to modify the curriculum." };

  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const level = await getGradeLevel(gradeLevelId);
  if (!level) return { error: "Grade level not found." };

  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const terms = Number(formData.get("terms") ?? 1);
  const creditUnits = Number(formData.get("creditUnits") ?? 1);

  if (!code) return { error: "Subject code is required." };
  if (!title) return { error: "Subject title is required." };
  if (!Number.isInteger(terms) || terms < 1) {
    return { error: "Number of terms must be at least 1." };
  }
  if (!Number.isInteger(creditUnits) || creditUnits < 1) {
    return { error: "Credit units must be at least 1." };
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM subject WHERE gradeLevelId = ? AND code = ?",
    gradeLevelId,
    code
  );
  if (existing) return { error: `Subject ${code} already exists in ${level.name}.` };

  await runSql(
    "INSERT INTO subject (id, gradeLevelId, code, title, terms, creditUnits, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    randomUUID(),
    gradeLevelId,
    code,
    title,
    terms,
    creditUnits,
    Date.now()
  );

  revalidatePath("/curriculum");
  revalidatePath(`/curriculum/${gradeLevelId}`);
  return { ok: true };
}

export async function deleteSubject(formData: FormData): Promise<void> {
  const actor = await currentAdmin();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  await runSql("DELETE FROM subject WHERE id = ? AND gradeLevelId = ?", id, gradeLevelId);

  revalidatePath("/curriculum");
  revalidatePath(`/curriculum/${gradeLevelId}`);
}

function parseXlsx(text: Buffer): { code: string; title: string; terms: number; creditUnits: number }[] {
  const wb = XLSX.read(text, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
  return rows.map((r) => ({
    code: String(r["Code"] ?? r["code"] ?? "").trim(),
    title: String(r["Title"] ?? r["title"] ?? "").trim(),
    terms: Number(r["Terms"] ?? r["terms"] ?? 1),
    creditUnits: Number(r["Credit Units"] ?? r["creditUnits"] ?? 1),
  }));
}

export interface BulkSubjectResult {
  added: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export async function bulkAddSubjects(formData: FormData): Promise<BulkSubjectResult> {
  const actor = await currentAdmin();
  if (!actor) return { added: 0, skipped: 0, invalid: 0, errors: ["You are not authorized to modify the curriculum."] };

  const gradeLevelId = String(formData.get("gradeLevelId") ?? "");
  const level = await getGradeLevel(gradeLevelId);
  if (!level) return { added: 0, skipped: 0, invalid: 0, errors: ["Grade level not found."] };

  const file = formData.get("file");
  if (!file || typeof file === "string") return { added: 0, skipped: 0, invalid: 0, errors: ["Choose an Excel file to upload."] };

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = parseXlsx(buffer);
  if (rows.length === 0) return { added: 0, skipped: 0, invalid: 0, errors: ["The file is empty or could not be parsed."] };

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const code = row.code;
    const title = row.title;
    const terms = Number(row.terms) || 1;
    const creditUnits = Number(row.creditUnits) || 1;

    if (!code) {
      invalid += 1;
      errors.push("Row missing subject code.");
      continue;
    }
    if (!title) {
      invalid += 1;
      errors.push(`Subject code ${code} is missing a title.`);
      continue;
    }
    if (!Number.isInteger(terms) || terms < 1) {
      invalid += 1;
      errors.push(`Subject code ${code} has invalid terms.`);
      continue;
    }
    if (!Number.isInteger(creditUnits) || creditUnits < 1) {
      invalid += 1;
      errors.push(`Subject code ${code} has invalid credit units.`);
      continue;
    }

    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM subject WHERE gradeLevelId = ? AND code = ?",
      gradeLevelId,
      code
    );
    if (existing) {
      skipped += 1;
      continue;
    }

    await runSql(
      "INSERT INTO subject (id, gradeLevelId, code, title, terms, creditUnits, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      gradeLevelId,
      code,
      title,
      terms,
      creditUnits,
      Date.now()
    );
    added += 1;
  }

  revalidatePath("/curriculum");
  revalidatePath(`/curriculum/${gradeLevelId}`);
  return { added, skipped, invalid, errors };
}
