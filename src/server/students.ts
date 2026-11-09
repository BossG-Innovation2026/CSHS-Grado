import "server-only";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import {
  isAdmin,
  ROLE_DEPARTMENT_HEAD,
  ROLE_PARENT,
  ROLE_REGISTRAR,
  ROLE_SCHOOL_HEAD,
  ROLE_TEACHER,
} from "@/lib/modules";
import type { SessionUser } from "@/lib/session";

const {
  student,
  enrollment,
  schoolClass,
  gradeLevel,
  classSubject,
  grade,
  gradeSubmission,
  academicRecord,
  parentLink,
  recordSurrender,
  user,
} = schema;

export interface StudentRow {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  sex: string;
  birthDate: string;
  parentName: string;
  parentContact: string;
  address: string;
}

export interface StudentListRow extends StudentRow {
  className: string | null;
  gradeLevelName: string | null;
}

export interface AcademicRecordRow {
  id: string;
  schoolName: string;
  schoolYear: string;
  gradeLevel: string;
  generalAverage: string;
  honors: string;
  completed: boolean;
  subjects: { subject: string; grade: string }[];
  note: string;
}

export interface StudentGradeRow {
  term: number;
  className: string;
  gradeLevelName: string;
  subjectCode: string;
  subjectTitle: string;
  value: number | null;
  status: string;
  teacherName: string | null;
}

export const studentColumns = {
  id: student.id,
  lrn: student.lrn,
  surname: student.surname,
  firstname: student.firstname,
  middlename: student.middlename,
  sex: student.sex,
  birthDate: student.birthDate,
  parentName: student.parentName,
  parentContact: student.parentContact,
  address: student.address,
};

export function fullName(s: Pick<StudentRow, "firstname" | "middlename" | "surname">): string {
  return [s.firstname, s.middlename, s.surname].filter(Boolean).join(" ");
}

export function listName(s: Pick<StudentRow, "firstname" | "middlename" | "surname">): string {
  return [s.surname, s.firstname, s.middlename].filter(Boolean).join(", ");
}

/**
 * Class ids a teacher may look at: the classes they advise and the classes
 * where they are the subject teacher. `null` means "every class".
 */
async function visibleClassIds(actor: SessionUser): Promise<string[] | null> {
  if (
    isAdmin(actor) ||
    actor.role === ROLE_REGISTRAR ||
    actor.role === ROLE_SCHOOL_HEAD ||
    actor.role === ROLE_DEPARTMENT_HEAD
  ) {
    return null;
  }
  const advised = await getDb()
    .select({ id: schoolClass.id })
    .from(schoolClass)
    .where(eq(schoolClass.adviserId, actor.id));
  const taught = await getDb()
    .select({ id: classSubject.classId })
    .from(classSubject)
    .where(eq(classSubject.teacherId, actor.id));
  return [...new Set([...advised, ...taught].map((r) => r.id))];
}

/** Students visible to the caller, optionally filtered by name or LRN. */
export async function listStudents(query = ""): Promise<StudentListRow[]> {
  const actor = await requireModule("personal_info");
  const scope = await visibleClassIds(actor);
  if (scope !== null && scope.length === 0) return [];

  const q = query.trim();
  const filters = [
    scope === null ? undefined : inArray(enrollment.classId, scope),
    q
      ? or(
          ilike(student.lrn, `%${q}%`),
          ilike(student.surname, `%${q}%`),
          ilike(student.firstname, `%${q}%`),
          ilike(student.middlename, `%${q}%`)
        )
      : undefined,
  ].filter(Boolean);

  const rows = await getDb()
    .select({ ...studentColumns, className: schoolClass.name, gradeLevelName: gradeLevel.name })
    .from(student)
    .leftJoin(enrollment, eq(enrollment.studentId, student.id))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .leftJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`)
    .limit(300);

  // A student can be enrolled once per class row; keep the first class only.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Full personal record. Callers must already have checked access. */
export async function findStudent(id: string): Promise<StudentRow | undefined> {
  const [row] = await getDb().select(studentColumns).from(student).where(eq(student.id, id)).limit(1);
  return row;
}

/** Can this signed-in user open this student's record? */
export async function canViewStudent(actor: SessionUser, studentId: string): Promise<boolean> {
  if (
    isAdmin(actor) ||
    actor.role === ROLE_REGISTRAR ||
    actor.role === ROLE_SCHOOL_HEAD ||
    actor.role === ROLE_DEPARTMENT_HEAD
  ) {
    return true;
  }
  if (actor.role === ROLE_TEACHER) {
    const scope = await visibleClassIds(actor);
    if (scope === null) return true;
    if (scope.length === 0) return false;
    const [row] = await getDb()
      .select({ id: enrollment.id })
      .from(enrollment)
      .where(and(eq(enrollment.studentId, studentId), inArray(enrollment.classId, scope)))
      .limit(1);
    return Boolean(row);
  }
  const [link] = await getDb()
    .select({ id: parentLink.id })
    .from(parentLink)
    .where(and(eq(parentLink.userId, actor.id), eq(parentLink.studentId, studentId)))
    .limit(1);
  return Boolean(link);
}

/** Personal record for an authorised caller, or undefined. */
export async function getStudent(id: string): Promise<StudentRow | undefined> {
  const actor = await requireModule("personal_info");
  if (!(await canViewStudent(actor, id))) return undefined;
  return findStudent(id);
}

export async function listStudentClasses(studentId: string) {
  return getDb()
    .select({
      classId: schoolClass.id,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      adviserId: schoolClass.adviserId,
    })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .where(eq(enrollment.studentId, studentId))
    .orderBy(asc(gradeLevel.sortOrder), sql`lower(${schoolClass.name})`);
}

export async function listAcademicRecords(studentId: string): Promise<AcademicRecordRow[]> {
  await requireModule("academic_info");
  const rows = await getDb()
    .select()
    .from(academicRecord)
    .where(eq(academicRecord.studentId, studentId))
    .orderBy(asc(academicRecord.schoolYear));
  return rows.map((r) => {
    let subjects: { subject: string; grade: string }[] = [];
    try {
      const parsed = JSON.parse(r.subjects);
      if (Array.isArray(parsed)) {
        subjects = parsed
          .filter((x) => x && typeof x === "object")
          .map((x) => ({ subject: String(x.subject ?? ""), grade: String(x.grade ?? "") }));
      }
    } catch {
      subjects = [];
    }
    return {
      id: r.id,
      schoolName: r.schoolName,
      schoolYear: r.schoolYear,
      gradeLevel: r.gradeLevel,
      generalAverage: r.generalAverage,
      honors: r.honors,
      completed: r.completed,
      subjects,
      note: r.note,
    };
  });
}

/**
 * Grade rows for one student across every school year/term. Parents only ever
 * receive approved rows (status `approved`).
 */
export async function listStudentGrades(
  studentId: string,
  options: { approvedOnly?: boolean } = {}
): Promise<StudentGradeRow[]> {
  const filters = [eq(grade.studentId, studentId)];
  if (options.approvedOnly) filters.push(eq(gradeSubmission.status, "approved"));
  const rows = await getDb()
    .select({
      term: classSubject.term,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      subjectCode: classSubject.code,
      subjectTitle: classSubject.title,
      value: grade.value,
      status: gradeSubmission.status,
      teacherName: schema.user.name,
    })
    .from(grade)
    .innerJoin(classSubject, eq(classSubject.id, grade.classSubjectId))
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
    .leftJoin(schema.user, eq(schema.user.id, classSubject.teacherId))
    .where(and(...filters))
    .orderBy(asc(gradeLevel.sortOrder), asc(classSubject.term), sql`lower(${classSubject.title})`);
  return rows.map((r) => ({ ...r, status: r.status ?? "draft" }));
}

/** Linked children for a parent/guardian account. */
export async function listChildrenForParent(userId: string): Promise<StudentRow[]> {
  return getDb()
    .select(studentColumns)
    .from(parentLink)
    .innerJoin(student, eq(student.id, parentLink.studentId))
    .where(eq(parentLink.userId, userId))
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`);
}

export async function isLinkedParent(userId: string, studentId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: parentLink.id })
    .from(parentLink)
    .where(and(eq(parentLink.userId, userId), eq(parentLink.studentId, studentId)))
    .limit(1);
  return Boolean(row);
}

/** Parent/guardian contact details live with the registrar office, not with teachers. */
export function canViewContactInfo(actor: Pick<SessionUser, "role">): boolean {
  return isAdmin(actor) || actor.role === ROLE_REGISTRAR;
}

export function canEditStudentInfo(actor: Pick<SessionUser, "role">): boolean {
  return canViewContactInfo(actor);
}

export interface ParentLinkRow {
  id: string;
  userId: string;
  parentName: string;
  parentEmail: string;
  relationship: string;
}

/** Parent/guardian accounts linked to one student. */
export async function listStudentParents(studentId: string): Promise<ParentLinkRow[]> {
  await requireModule("personal_info");
  return getDb()
    .select({
      id: parentLink.id,
      userId: user.id,
      parentName: user.name,
      parentEmail: user.email,
      relationship: parentLink.relationship,
    })
    .from(parentLink)
    .innerJoin(user, eq(user.id, parentLink.userId))
    .where(eq(parentLink.studentId, studentId))
    .orderBy(sql`lower(${user.name})`);
}

/** Parent accounts the registrar can link to a student. */
export async function listParentAccounts(): Promise<{ id: string; name: string; email: string }[]> {
  await requireModule("personal_info");
  return getDb()
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.role, ROLE_PARENT), eq(user.active, true)))
    .orderBy(sql`lower(${user.name})`);
}

export interface SurrenderRow {
  id: string;
  reason: string;
  status: string;
  note: string;
  surrenderedAt: Date;
  receivedAt: Date | null;
  surrenderedByName: string | null;
  receivedByName: string | null;
}

/** Record-custody trail for one student. */
export async function listSurrendersForStudent(studentId: string): Promise<SurrenderRow[]> {
  await requireModule("personal_info");
  const surrenderedBy = alias(user, "surrendered_by");
  const receivedBy = alias(user, "received_by");
  return getDb()
    .select({
      id: recordSurrender.id,
      reason: recordSurrender.reason,
      status: recordSurrender.status,
      note: recordSurrender.note,
      surrenderedAt: recordSurrender.surrenderedAt,
      receivedAt: recordSurrender.receivedAt,
      surrenderedByName: surrenderedBy.name,
      receivedByName: receivedBy.name,
    })
    .from(recordSurrender)
    .leftJoin(surrenderedBy, eq(surrenderedBy.id, recordSurrender.surrenderedBy))
    .leftJoin(receivedBy, eq(receivedBy.id, recordSurrender.receivedBy))
    .where(eq(recordSurrender.studentId, studentId))
    .orderBy(sql`${recordSurrender.surrenderedAt} desc`)
    .limit(20);
}
