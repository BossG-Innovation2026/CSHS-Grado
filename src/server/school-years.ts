import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/access";
import type { PolicyKey } from "@/lib/grading";

const { schoolYear, schoolYearTerm } = schema;

export interface SchoolYearRow {
  id: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  policyKey: PolicyKey;
}

export interface SchoolYearTermRow {
  term: number;
  startsOn: string | null;
  endsOn: string | null;
  submissionDeadline: string | null;
}

const yearColumns = {
  id: schoolYear.id,
  startsOn: schoolYear.startsOn,
  endsOn: schoolYear.endsOn,
  isCurrent: schoolYear.isCurrent,
  policyKey: schoolYear.policyKey,
};

export async function listSchoolYears(): Promise<(SchoolYearRow & { terms: SchoolYearTermRow[] })[]> {
  await requireAdmin();
  const db = getDb();
  const [years, terms] = await Promise.all([
    db.select(yearColumns).from(schoolYear).orderBy(desc(schoolYear.startsOn)),
    db.select().from(schoolYearTerm).orderBy(asc(schoolYearTerm.term)),
  ]);
  return years.map((year) => ({
    ...year,
    policyKey: year.policyKey as PolicyKey,
    terms: terms
      .filter((t) => t.schoolYearId === year.id)
      .map((t) => ({
        term: t.term,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
        submissionDeadline: t.submissionDeadline,
      })),
  }));
}

/* Internal helper (no access check: callers check first). */

/** The year new classes belong to. A migration creates the first; one is always current. */
export async function findCurrentSchoolYear(): Promise<SchoolYearRow> {
  const [year] = await getDb().select(yearColumns).from(schoolYear).where(eq(schoolYear.isCurrent, true)).limit(1);
  if (!year) throw new Error("No current school year is set.");
  return { ...year, policyKey: year.policyKey as PolicyKey };
}
