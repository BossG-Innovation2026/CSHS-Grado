import "server-only";
import { asc, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";

const { gradeLevel, subject } = schema;

export interface GradeLevelRow {
  id: string;
  name: string;
  sortOrder: number;
}

export interface SubjectRow {
  id: string;
  gradeLevelId: string;
  code: string;
  title: string;
  terms: number;
  creditUnits: number;
}

/* Reads: only callable from server code; each one re-checks module access. */

export async function listGradeLevels(): Promise<GradeLevelRow[]> {
  await requireModule("curriculum");
  return getDb()
    .select({ id: gradeLevel.id, name: gradeLevel.name, sortOrder: gradeLevel.sortOrder })
    .from(gradeLevel)
    .orderBy(asc(gradeLevel.sortOrder));
}

export async function getGradeLevel(id: string): Promise<GradeLevelRow | undefined> {
  await requireModule("curriculum");
  return findGradeLevel(id);
}

export async function listSubjects(gradeLevelId: string): Promise<SubjectRow[]> {
  await requireModule("curriculum");
  return getDb()
    .select({
      id: subject.id,
      gradeLevelId: subject.gradeLevelId,
      code: subject.code,
      title: subject.title,
      terms: subject.terms,
      creditUnits: subject.creditUnits,
    })
    .from(subject)
    .where(eq(subject.gradeLevelId, gradeLevelId))
    .orderBy(sql`lower(${subject.title})`);
}

export async function countSubjectsByGrade(): Promise<Record<string, number>> {
  await requireModule("curriculum");
  const rows = await getDb()
    .select({ gradeLevelId: subject.gradeLevelId, count: count() })
    .from(subject)
    .groupBy(subject.gradeLevelId);
  return Object.fromEntries(rows.map((r) => [r.gradeLevelId, Number(r.count)]));
}

/* Internal helpers (no access check: callers check first). */

export async function findGradeLevel(id: string): Promise<GradeLevelRow | undefined> {
  const [row] = await getDb()
    .select({ id: gradeLevel.id, name: gradeLevel.name, sortOrder: gradeLevel.sortOrder })
    .from(gradeLevel)
    .where(eq(gradeLevel.id, id))
    .limit(1);
  return row;
}
