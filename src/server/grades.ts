import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import { isAdmin, ROLE_REGISTRAR, ROLE_SCHOOL_HEAD, ROLE_DEPARTMENT_HEAD } from "@/lib/modules";
import type { SessionUser } from "@/lib/session";
import type { SubmissionStatus } from "@/lib/grades";
import { studentColumns, type StudentRow } from "@/server/students";

export type { SubmissionStatus } from "@/lib/grades";
export { STATUS_LABELS, STATUS_STYLES } from "@/lib/grades";

const { classSubject, schoolClass, gradeLevel, user, enrollment, student, grade, gradeSubmission, signedSheet } = schema;
const adviser = alias(user, "adviser");

export interface SubmissionInfo {
  status: SubmissionStatus;
  returnNote: string;
  submittedAt: Date | null;
  adviserVerifiedAt: Date | null;
  registrarVerifiedAt: Date | null;
}

export interface SubjectOffering {
  id: string;
  classId: string;
  className: string;
  strand: string;
  schoolYear: string;
  gradeLevelName: string;
  code: string;
  title: string;
  term: number;
  teacherId: string | null;
  teacherName: string | null;
  adviserId: string;
  adviserName: string;
  status: SubmissionStatus;
  returnNote: string;
  studentCount: number;
  encodedCount: number;
  sheetReceivedAt: Date | null;
  wwWeight: number;
  ptWeight: number;
  otherWeight: number;
}

interface OfferingBase {
  id: string;
  classId: string;
  className: string;
  strand: string;
  schoolYear: string;
  gradeLevelName: string;
  code: string;
  title: string;
  term: number;
  teacherId: string | null;
  teacherName: string | null;
  adviserId: string;
  adviserName: string;
  status: SubmissionStatus;
  returnNote: string;
  wwWeight: number;
  ptWeight: number;
  otherWeight: number;
}

const offeringColumns = {
  id: classSubject.id,
  classId: classSubject.classId,
  className: schoolClass.name,
  strand: schoolClass.strand,
  schoolYear: schoolClass.schoolYear,
  gradeLevelName: gradeLevel.name,
  code: classSubject.code,
  title: classSubject.title,
  term: classSubject.term,
  teacherId: classSubject.teacherId,
  teacherName: user.name,
  adviserId: schoolClass.adviserId,
  adviserName: sql<string>`coalesce(${adviser.name}, '')`,
  status: sql<SubmissionStatus>`coalesce(${gradeSubmission.status}, 'draft')`,
  returnNote: sql<string>`coalesce(${gradeSubmission.returnNote}, '')`,
  wwWeight: classSubject.wwWeight,
  ptWeight: classSubject.ptWeight,
  otherWeight: classSubject.otherWeight,
};

function baseOfferingQuery() {
  return getDb()
    .select(offeringColumns)
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .leftJoin(user, eq(user.id, classSubject.teacherId))
    .leftJoin(adviser, eq(adviser.id, schoolClass.adviserId))
    .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id));
}

async function decorate(rows: OfferingBase[]): Promise<SubjectOffering[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const counts = await getDb()
    .select({
      classSubjectId: classSubject.id,
      students: sql<number>`count(distinct ${enrollment.studentId})`.mapWith(Number),
      encoded: sql<number>`count(distinct case when ${grade.value} is not null then ${grade.studentId} end)`.mapWith(
        Number
      ),
    })
    .from(classSubject)
    .leftJoin(enrollment, eq(enrollment.classId, classSubject.classId))
    .leftJoin(grade, and(eq(grade.classSubjectId, classSubject.id), eq(grade.studentId, enrollment.studentId)))
    .where(inArray(classSubject.id, ids))
    .groupBy(classSubject.id);
  const sheets = await getDb()
    .select({ classSubjectId: signedSheet.classSubjectId, receivedAt: signedSheet.receivedAt })
    .from(signedSheet)
    .where(inArray(signedSheet.classSubjectId, ids));
  const countMap = new Map(counts.map((c) => [c.classSubjectId, c]));
  const sheetMap = new Map(sheets.map((s) => [s.classSubjectId, s.receivedAt]));
  return rows.map((r) => ({
    ...r,
    status: (r.status ?? "draft") as SubmissionStatus,
    studentCount: countMap.get(r.id)?.students ?? 0,
    encodedCount: countMap.get(r.id)?.encoded ?? 0,
    sheetReceivedAt: sheetMap.get(r.id) ?? null,
  }));
}

/** Subjects a teacher may encode: those they teach, plus their advisory class. */
export async function listMyOfferings(): Promise<SubjectOffering[]> {
  const actor = await requireModule("grades_submit");
  const rows = await baseOfferingQuery()
    .where(or(eq(classSubject.teacherId, actor.id), eq(schoolClass.adviserId, actor.id)))
    .orderBy(
      asc(gradeLevel.sortOrder),
      sql`lower(${schoolClass.name})`,
      asc(classSubject.term),
      sql`lower(${classSubject.title})`
    );
  return decorate(rows);
}

/** Verification queue. Advisers see their own classes; registrar and heads see all. */
export async function listVerificationQueue(): Promise<SubjectOffering[]> {
  const actor = await requireModule("grades_approve");
  const rows = await baseOfferingQuery()
    .where(eq(schoolClass.adviserId, actor.id))
    .orderBy(asc(gradeLevel.sortOrder), sql`lower(${schoolClass.name})`, asc(classSubject.term));
  const q = actor.role === ROLE_REGISTRAR || isAdmin(actor) || actor.role === ROLE_SCHOOL_HEAD || actor.role === ROLE_DEPARTMENT_HEAD;
  if (!q) return decorate(rows);
  const all = await baseOfferingQuery().orderBy(
    asc(gradeLevel.sortOrder),
    sql`lower(${schoolClass.name})`,
    asc(classSubject.term)
  );
  return decorate(all);
}

export interface SheetStudent extends StudentRow {
  gradeValue: number | null;
  writtenWork: number | null;
  performanceTask: number | null;
  otherAssessment: number | null;
}

export interface SubjectSheet {
  offering: SubjectOffering;
  students: SheetStudent[];
  submission: SubmissionInfo;
  canEncode: boolean;
  canVerify: boolean;
  canApprove: boolean;
  sheets: { id: string; referenceNo: string; receivedAt: Date; note: string }[];
}

/** Load one subject sheet, after checking the caller may see it. */
export async function findSheet(actor: SessionUser, classSubjectId: string): Promise<SubjectSheet | undefined> {
  const [row] = await baseOfferingQuery().where(eq(classSubject.id, classSubjectId)).limit(1);
  if (!row) return undefined;

  const isSubjectTeacher = row.teacherId === actor.id;
  const isAdviser = row.adviserId === actor.id;
  const isRegistrar = actor.role === ROLE_REGISTRAR || isAdmin(actor);
  const isHead = actor.role === ROLE_SCHOOL_HEAD || actor.role === ROLE_DEPARTMENT_HEAD;
  if (!isSubjectTeacher && !isAdviser && !isRegistrar && !isHead) return undefined;

  const [decorated] = await decorate([row]);
  const students = await getDb()
    .select({
      ...studentColumns,
      gradeValue: grade.value,
      writtenWork: grade.writtenWork,
      performanceTask: grade.performanceTask,
      otherAssessment: grade.otherAssessment,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .leftJoin(grade, and(eq(grade.studentId, student.id), eq(grade.classSubjectId, classSubjectId)))
    .where(eq(enrollment.classId, row.classId))
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`);

  const [submissionRow] = await getDb()
    .select()
    .from(gradeSubmission)
    .where(eq(gradeSubmission.classSubjectId, classSubjectId))
    .limit(1);
  const status = (submissionRow?.status ?? "draft") as SubmissionStatus;
  const sheets = await getDb()
    .select({
      id: signedSheet.id,
      referenceNo: signedSheet.referenceNo,
      receivedAt: signedSheet.receivedAt,
      note: signedSheet.note,
    })
    .from(signedSheet)
    .where(eq(signedSheet.classSubjectId, classSubjectId))
    .orderBy(sql`${signedSheet.receivedAt} desc`);

  return {
    offering: decorated,
    students,
    submission: {
      status,
      returnNote: submissionRow?.returnNote ?? "",
      submittedAt: submissionRow?.submittedAt ?? null,
      adviserVerifiedAt: submissionRow?.adviserVerifiedAt ?? null,
      registrarVerifiedAt: submissionRow?.registrarVerifiedAt ?? null,
    },
    canEncode: (isSubjectTeacher || isAdviser) && (status === "draft" || status === "returned"),
    canVerify: (isAdviser || isHead) && status === "submitted",
    canApprove: isRegistrar && status === "verified",
    sheets,
  };
}

/** Approved grades only. Callers must have checked the parent link first. */
export async function findApprovedGradesForStudent(studentId: string) {
  return getDb()
    .select({
      term: classSubject.term,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      subjectCode: classSubject.code,
      subjectTitle: classSubject.title,
      value: grade.value,
    })
    .from(grade)
    .innerJoin(classSubject, eq(classSubject.id, grade.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .innerJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
    .where(and(eq(grade.studentId, studentId), eq(gradeSubmission.status, "approved")))
    .orderBy(asc(gradeLevel.sortOrder), asc(classSubject.term), sql`lower(${classSubject.title})`);
}
