import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import { isAdmin } from "@/lib/modules";
import type { SessionUser } from "@/lib/session";

const { schoolClass, classSubject, gradeLevel, subject, user, student, enrollment } = schema;

export interface ClassRow {
  id: string;
  name: string;
  strand: string;
  schoolYear: string;
  gradeLevelId: string;
  gradeLevelName: string;
  adviserId: string;
  adviserName: string;
}

export interface ClassSubjectRow {
  id: string;
  classId: string;
  subjectId: string | null;
  code: string;
  title: string;
  description: string;
  teacherId: string | null;
  teacherName: string | null;
  term: number;
  wwWeight: number;
  ptWeight: number;
  otherWeight: number;
}

export interface StudentRow {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  sex: string;
}

const classColumns = {
  id: schoolClass.id,
  name: schoolClass.name,
  strand: schoolClass.strand,
  schoolYear: schoolClass.schoolYear,
  gradeLevelId: schoolClass.gradeLevelId,
  gradeLevelName: gradeLevel.name,
  adviserId: schoolClass.adviserId,
  adviserName: user.name,
};

/* Reads: only callable from server code; each one re-checks module access. */

export async function listClasses(): Promise<ClassRow[]> {
  await requireModule("classes");
  return getDb()
    .select(classColumns)
    .from(schoolClass)
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .innerJoin(user, eq(user.id, schoolClass.adviserId))
    .orderBy(asc(gradeLevel.sortOrder), sql`lower(${schoolClass.name})`);
}

export async function getClass(id: string): Promise<ClassRow | undefined> {
  await requireModule("classes");
  return findClass(id);
}

export async function listClassSubjects(classId: string, term: number): Promise<ClassSubjectRow[]> {
  await requireModule("classes");
  return getDb()
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      subjectId: classSubject.subjectId,
      code: classSubject.code,
      title: classSubject.title,
      description: classSubject.description,
      teacherId: classSubject.teacherId,
      teacherName: user.name,
      term: classSubject.term,
      wwWeight: classSubject.wwWeight,
      ptWeight: classSubject.ptWeight,
      otherWeight: classSubject.otherWeight,
    })
    .from(classSubject)
    .leftJoin(user, eq(user.id, classSubject.teacherId))
    .where(and(eq(classSubject.classId, classId), eq(classSubject.term, term)))
    .orderBy(sql`lower(${classSubject.title})`);
}

export async function listActiveTeachers(): Promise<{ id: string; name: string }[]> {
  await requireModule("classes");
  return getDb()
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.role, "teacher"), eq(user.active, true)))
    .orderBy(sql`lower(${user.name})`);
}

export async function listGradeLevelsForClasses(): Promise<{ id: string; name: string }[]> {
  await requireModule("classes");
  return getDb()
    .select({ id: gradeLevel.id, name: gradeLevel.name })
    .from(gradeLevel)
    .orderBy(asc(gradeLevel.sortOrder));
}

export async function countClassesByGrade(): Promise<Record<string, number>> {
  await requireModule("classes");
  const rows = await getDb()
    .select({ gradeLevelId: schoolClass.gradeLevelId, count: count() })
    .from(schoolClass)
    .groupBy(schoolClass.gradeLevelId);
  return Object.fromEntries(rows.map((r) => [r.gradeLevelId, Number(r.count)]));
}

export async function listSubjectsByGrade(
  gradeLevelId: string
): Promise<{ id: string; code: string; title: string }[]> {
  await requireModule("classes");
  return getDb()
    .select({ id: subject.id, code: subject.code, title: subject.title })
    .from(subject)
    .where(eq(subject.gradeLevelId, gradeLevelId))
    .orderBy(sql`lower(${subject.title})`);
}

export async function listStudents(classId: string): Promise<StudentRow[]> {
  await requireModule("classes");
  return getDb()
    .select({
      id: student.id,
      lrn: student.lrn,
      surname: student.surname,
      firstname: student.firstname,
      middlename: student.middlename,
      sex: student.sex,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(eq(enrollment.classId, classId))
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`);
}

/* Internal helpers (no access check: callers check first). */

export async function findClass(id: string): Promise<ClassRow | undefined> {
  const [row] = await getDb()
    .select(classColumns)
    .from(schoolClass)
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .innerJoin(user, eq(user.id, schoolClass.adviserId))
    .where(eq(schoolClass.id, id))
    .limit(1);
  return row;
}

/** Admins manage every class; everyone else only the classes they advise. */
export async function canManageClass(actor: SessionUser, classId: string): Promise<boolean> {
  if (isAdmin(actor)) return true;
  const [row] = await getDb()
    .select({ adviserId: schoolClass.adviserId })
    .from(schoolClass)
    .where(eq(schoolClass.id, classId))
    .limit(1);
  return row?.adviserId === actor.id;
}
