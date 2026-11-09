"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { TERMS } from "@/lib/terms";
import { adminUser, checkOwnPassword } from "@/server/guards";

const { schoolYear, schoolYearTerm } = schema;

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const NOT_ALLOWED: ActionState = { error: "Only a System Admin can change school years." };

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A blank optional date, a valid date, or undefined when invalid. */
function optionalDate(raw: FormDataEntryValue | null): string | null | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  return isDate(value) ? value : undefined;
}

export async function addSchoolYear(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminUser())) return NOT_ALLOWED;

  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  if (!isDate(startsOn) || !isDate(endsOn)) return { error: "Enter valid start and end dates." };
  if (endsOn <= startsOn) return { error: "The end date must be after the start date." };

  const startYear = Number(startsOn.slice(0, 4));
  if (Number(endsOn.slice(0, 4)) !== startYear + 1) {
    return { error: "A school year must end in the calendar year after it starts." };
  }

  const id = `${startYear}-${startYear + 1}`;
  const created = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(schoolYear)
      .values({ id, startsOn, endsOn, isCurrent: false })
      .onConflictDoNothing({ target: schoolYear.id })
      .returning({ id: schoolYear.id });
    if (inserted.length === 0) return false;
    await tx.insert(schoolYearTerm).values(TERMS.map((term) => ({ schoolYearId: id, term })));
    return true;
  });
  if (!created) return { error: `School year ${id} already exists.` };

  revalidatePath("/settings/school-year");
  return { ok: true };
}

export async function setCurrentSchoolYear(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return NOT_ALLOWED;
  const passwordError = await checkOwnPassword(actor, String(formData.get("password") ?? ""));
  if (passwordError) return { error: passwordError };

  const id = String(formData.get("id") ?? "");
  const found = await getDb().transaction(async (tx) => {
    const [target] = await tx.select({ id: schoolYear.id }).from(schoolYear).where(eq(schoolYear.id, id)).limit(1);
    if (!target) return false;
    // Clear first: the unique index allows only one current year at any moment.
    await tx.update(schoolYear).set({ isCurrent: false }).where(eq(schoolYear.isCurrent, true));
    await tx.update(schoolYear).set({ isCurrent: true }).where(eq(schoolYear.id, id));
    return true;
  });
  if (!found) return { error: "School year not found." };

  revalidatePath("/settings/school-year");
  revalidatePath("/classes");
  return { ok: true };
}

export async function saveTermDates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await adminUser())) return NOT_ALLOWED;

  const id = String(formData.get("id") ?? "");
  const rows: { term: number; startsOn: string | null; endsOn: string | null; submissionDeadline: string | null }[] = [];
  for (const term of TERMS) {
    const startsOn = optionalDate(formData.get(`startsOn${term}`));
    const endsOn = optionalDate(formData.get(`endsOn${term}`));
    const submissionDeadline = optionalDate(formData.get(`deadline${term}`));
    if (startsOn === undefined || endsOn === undefined || submissionDeadline === undefined) {
      return { error: `Term ${term} has an invalid date.` };
    }
    if (startsOn && endsOn && endsOn < startsOn) {
      return { error: `Term ${term} ends before it starts.` };
    }
    rows.push({ term, startsOn, endsOn, submissionDeadline });
  }

  await getDb().transaction(async (tx) => {
    for (const { term, ...dates } of rows) {
      await tx
        .update(schoolYearTerm)
        .set(dates)
        .where(and(eq(schoolYearTerm.schoolYearId, id), eq(schoolYearTerm.term, term)));
    }
  });

  revalidatePath("/settings/school-year");
  return { ok: true };
}
