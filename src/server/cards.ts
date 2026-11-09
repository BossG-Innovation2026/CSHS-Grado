import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { remarkFor } from "@/lib/grades";
import { findStudent, type StudentRow } from "@/server/students";

const { enrollment, schoolClass, gradeLevel, classSubject, grade, gradeSubmission, user, schoolSettings } = schema;

export interface CardGradeRow {
  code: string;
  title: string;
  value: number | null;
  status: string;
  remark: string;
}

export interface CardTerm {
  term: number;
  rows: CardGradeRow[];
}

export interface StudentCard {
  student: StudentRow;
  className: string | null;
  gradeLevelName: string | null;
  adviserName: string | null;
  terms: CardTerm[];
  generalAverage: number | null;
  approvedOnly: boolean;
  school: { name: string; address: string; schoolId: string; principal: string };
}

/**
 * Everything a report card needs. The caller must check access before calling
 * (registrar, or a parent linked to this student). `approvedOnly` is used for
 * the parent portal and printed cards; staff record views may include drafts.
 */
export async function buildStudentCard(
  studentId: string,
  options: { approvedOnly?: boolean } = {}
): Promise<StudentCard | undefined> {
  const approvedOnly = options.approvedOnly ?? true;
  const student = await findStudent(studentId);
  if (!student) return undefined;

  const db = getDb();
  const [current] = await db
    .select({
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      adviserName: user.name,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .innerJoin(user, eq(user.id, schoolClass.adviserId))
    .where(eq(enrollment.studentId, studentId))
    .orderBy(desc(schoolClass.createdAt))
    .limit(1);

  const filters = [eq(grade.studentId, studentId)];
  if (approvedOnly) filters.push(eq(gradeSubmission.status, "approved"));
  const rows = await db
    .select({
      term: classSubject.term,
      code: classSubject.code,
      title: classSubject.title,
      value: grade.value,
      status: sql<string>`coalesce(${gradeSubmission.status}, 'draft')`,
    })
    .from(grade)
    .innerJoin(classSubject, eq(classSubject.id, grade.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
    .where(and(...filters))
    .orderBy(gradeLevel.sortOrder, classSubject.term, sql`lower(${classSubject.title})`);

  const termMap = new Map<number, CardGradeRow[]>();
  const values: number[] = [];
  for (const r of rows) {
    const row: CardGradeRow = {
      code: r.code,
      title: r.title,
      value: r.value,
      status: r.status,
      remark: remarkFor(r.value),
    };
    if (!termMap.has(r.term)) termMap.set(r.term, []);
    termMap.get(r.term)!.push(row);
    if (r.value !== null) values.push(r.value);
  }

  const [school] = await db.select().from(schoolSettings).limit(1);
  const generalAverage =
    values.length === 0
      ? null
      : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;

  return {
    student,
    className: current?.className ?? null,
    gradeLevelName: current?.gradeLevelName ?? null,
    adviserName: current?.adviserName ?? null,
    terms: [...termMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([term, termRows]) => ({ term, rows: termRows })),
    generalAverage,
    approvedOnly,
    school: {
      name: school?.name ?? "Project Grado",
      address: school?.address ?? "",
      schoolId: school?.schoolId ?? "",
      principal: school?.principal ?? "",
    },
  };
}
