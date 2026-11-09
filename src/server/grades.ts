import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import { ROLE_DEPARTMENT_HEAD, ROLE_REGISTRAR, ROLE_SCHOOL_HEAD, isAdmin } from "@/lib/modules";
import type { SessionUser } from "@/lib/session";
import type { DbOrTx } from "@/server/audit";
import { canManageClass, findClass, type ClassRow } from "@/server/classes";
import { findCurrentSchoolYear } from "@/server/school-years";

const { classSubject, enrollment, finalGrade, gradeLevel, gradeSubmission, schoolClass, schoolYear, student, user } =
  schema;

export type SubmissionStatus = "draft" | "submitted" | "approved" | "returned";

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  returned: "Returned",
};

export interface SubjectContext {
  id: string;
  classId: string;
  code: string;
  title: string;
  term: number;
  teacherId: string | null;
  className: string;
  gradeLevelName: string;
  schoolYearId: string;
  isCurrentYear: boolean;
  status: SubmissionStatus;
  returnNote: string | null;
}

export interface SheetStudent {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
}

export interface GradeSheet extends SubjectContext {
  canEdit: boolean;
  students: SheetStudent[];
  /** studentId -> final grade. */
  grades: Record<string, number>;
}

export interface TeacherSubjectRow {
  id: string;
  code: string;
  title: string;
  term: number;
  className: string;
  gradeLevelName: string;
  status: SubmissionStatus;
}

export interface ConsolidatedSubject {
  id: string;
  code: string;
  title: string;
  teacherName: string | null;
  status: SubmissionStatus;
}

export interface ConsolidatedSheet {
  cls: ClassRow;
  subjects: ConsolidatedSubject[];
  students: SheetStudent[];
  /** classSubjectId -> studentId -> final grade, for submitted or approved subjects only. */
  grades: Record<string, Record<string, number>>;
}

/* Reads: only callable from server code; each one re-checks access. */

export async function listMySubjects(): Promise<TeacherSubjectRow[]> {
  const actor = await requireModule("grades_submit");
  const year = await findCurrentSchoolYear();
  const rows = await getDb()
    .select({
      id: classSubject.id,
      code: classSubject.code,
      title: classSubject.title,
      term: classSubject.term,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      status: gradeSubmission.status,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
    .where(and(eq(classSubject.teacherId, actor.id), eq(schoolClass.schoolYearId, year.id)))
    .orderBy(asc(classSubject.term), asc(gradeLevel.sortOrder), sql`lower(${schoolClass.name})`, asc(classSubject.code));
  return rows.map((r) => ({ ...r, status: (r.status ?? "draft") as SubmissionStatus }));
}

/** The sheet for the subject's own teacher, or null for anyone else. */
export async function getGradeSheet(classSubjectId: string): Promise<GradeSheet | null> {
  const actor = await requireModule("grades_submit");
  const context = await findSubjectContext(classSubjectId);
  if (!context || !canEnterGrades(actor, context)) return null;

  const [students, rows] = await Promise.all([
    findRoster(context.classId),
    getDb()
      .select({ studentId: finalGrade.studentId, grade: finalGrade.grade })
      .from(finalGrade)
      .where(eq(finalGrade.classSubjectId, classSubjectId)),
  ]);

  return {
    ...context,
    canEdit: editBlock(context) === null,
    students,
    grades: Object.fromEntries(rows.map((r) => [r.studentId, r.grade])),
  };
}

/** Every subject's final grades for one class and term, or null without access. */
export async function getConsolidatedSheet(classId: string, term: number): Promise<ConsolidatedSheet | null> {
  const actor = await requireModule("classes");
  const cls = await findClass(classId);
  if (!cls || !(await canViewConsolidated(actor, classId))) return null;

  const db = getDb();
  const [subjectRows, students] = await Promise.all([
    db
      .select({
        id: classSubject.id,
        code: classSubject.code,
        title: classSubject.title,
        teacherName: user.name,
        status: gradeSubmission.status,
      })
      .from(classSubject)
      .leftJoin(user, eq(user.id, classSubject.teacherId))
      .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
      .where(and(eq(classSubject.classId, classId), eq(classSubject.term, term)))
      .orderBy(sql`lower(${classSubject.title})`),
    findRoster(classId),
  ]);
  const subjects = subjectRows.map((s) => ({ ...s, status: (s.status ?? "draft") as SubmissionStatus }));

  // A teacher's draft stays private until it is submitted.
  const visible = subjects.filter((s) => s.status === "submitted" || s.status === "approved").map((s) => s.id);
  const rows = visible.length
    ? await db
        .select({
          classSubjectId: finalGrade.classSubjectId,
          studentId: finalGrade.studentId,
          grade: finalGrade.grade,
        })
        .from(finalGrade)
        .where(inArray(finalGrade.classSubjectId, visible))
    : [];

  const grades: ConsolidatedSheet["grades"] = {};
  for (const row of rows) (grades[row.classSubjectId] ??= {})[row.studentId] = row.grade;
  return { cls, subjects, students, grades };
}

/* Internal helpers (no access check: callers check first). */

export async function canViewConsolidated(actor: SessionUser, classId: string): Promise<boolean> {
  if ([ROLE_SCHOOL_HEAD, ROLE_REGISTRAR, ROLE_DEPARTMENT_HEAD].includes(actor.role)) return true;
  return canManageClass(actor, classId);
}

export async function findSubjectContext(
  classSubjectId: string,
  db: DbOrTx = getDb()
): Promise<SubjectContext | undefined> {
  const [row] = await db
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      code: classSubject.code,
      title: classSubject.title,
      term: classSubject.term,
      teacherId: classSubject.teacherId,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      schoolYearId: schoolYear.id,
      isCurrentYear: schoolYear.isCurrent,
      status: gradeSubmission.status,
      returnNote: gradeSubmission.returnNote,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .innerJoin(schoolYear, eq(schoolYear.id, schoolClass.schoolYearId))
    .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
    .where(eq(classSubject.id, classSubjectId))
    .limit(1);
  return row ? { ...row, status: (row.status ?? "draft") as SubmissionStatus } : undefined;
}

export async function findRoster(classId: string, db: DbOrTx = getDb()): Promise<SheetStudent[]> {
  return db
    .select({ id: student.id, lrn: student.lrn, surname: student.surname, firstname: student.firstname })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(eq(enrollment.classId, classId))
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`);
}

/** Only the assigned teacher enters grades, and never a System Admin. */
export function canEnterGrades(actor: SessionUser, context: SubjectContext): boolean {
  return !isAdmin(actor) && context.teacherId === actor.id;
}

/** Why this sheet cannot be changed right now, or null when it can. */
export function editBlock(context: SubjectContext): string | null {
  if (!context.isCurrentYear) return "This class belongs to a past school year.";
  if (context.status === "submitted") return "These grades were submitted and are locked unless returned.";
  if (context.status === "approved") return "These grades are approved and locked.";
  return null;
}

/* Retention (DepEd Order 015 para. 61): grades block these deletions. */

export async function classHasGrades(classId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: finalGrade.classSubjectId })
    .from(finalGrade)
    .innerJoin(classSubject, eq(classSubject.id, finalGrade.classSubjectId))
    .where(eq(classSubject.classId, classId))
    .limit(1);
  return Boolean(row);
}

export async function subjectHasGrades(classSubjectId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: finalGrade.classSubjectId })
    .from(finalGrade)
    .where(eq(finalGrade.classSubjectId, classSubjectId))
    .limit(1);
  return Boolean(row);
}

export async function gradeLevelHasGrades(gradeLevelId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: finalGrade.classSubjectId })
    .from(finalGrade)
    .innerJoin(classSubject, eq(classSubject.id, finalGrade.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .where(eq(schoolClass.gradeLevelId, gradeLevelId))
    .limit(1);
  return Boolean(row);
}

export async function studentHasGrades(classId: string, studentId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: finalGrade.classSubjectId })
    .from(finalGrade)
    .innerJoin(classSubject, eq(classSubject.id, finalGrade.classSubjectId))
    .where(and(eq(classSubject.classId, classId), eq(finalGrade.studentId, studentId)))
    .limit(1);
  return Boolean(row);
}
