import "server-only";
import { asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";

const {
  student,
  schoolClass,
  gradeLevel,
  enrollment,
  classSubject,
  gradeSubmission,
  recordSurrender,
  signedSheet,
  parentLink,
  user,
} = schema;

export interface RegistrarSummary {
  students: number;
  classes: number;
  subjects: number;
  missing: number;
  draft: number;
  submitted: number;
  verified: number;
  approved: number;
  returned: number;
  pendingSurrenders: number;
  signedSheets: number;
  parentLinks: number;
}

export async function getRegistrarSummary(): Promise<RegistrarSummary> {
  await requireModule("registrar");
  const db = getDb();

  const [students] = await db.select({ n: count() }).from(student);
  const [classes] = await db.select({ n: count() }).from(schoolClass);
  const [subjects] = await db.select({ n: count() }).from(classSubject);
  const [pendingSurrenders] = await db
    .select({ n: count() })
    .from(recordSurrender)
    .where(eq(recordSurrender.status, "pending"));
  const [signedSheets] = await db.select({ n: count() }).from(signedSheet);
  const [parentLinks] = await db.select({ n: count() }).from(parentLink);
  const statuses = await db
    .select({ status: gradeSubmission.status, n: count() })
    .from(gradeSubmission)
    .groupBy(gradeSubmission.status);

  const byStatus = Object.fromEntries(statuses.map((r) => [r.status, Number(r.n)]));
  const draft = byStatus.draft ?? 0;
  const submitted = byStatus.submitted ?? 0;
  const verified = byStatus.verified ?? 0;
  const approved = byStatus.approved ?? 0;
  const returned = byStatus.returned ?? 0;

  return {
    students: Number(students.n),
    classes: Number(classes.n),
    subjects: Number(subjects.n),
    missing: Math.max(0, Number(subjects.n) - (draft + submitted + verified + approved + returned)),
    draft,
    submitted,
    verified,
    approved,
    returned,
    pendingSurrenders: Number(pendingSurrenders.n),
    signedSheets: Number(signedSheets.n),
    parentLinks: Number(parentLinks.n),
  };
}

export interface RegistrarSurrenderRow {
  id: string;
  studentId: string;
  studentName: string;
  lrn: string;
  className: string | null;
  reason: string;
  status: string;
  note: string;
  surrenderedAt: Date;
  receivedAt: Date | null;
  surrenderedByName: string | null;
  receivedByName: string | null;
}

/** Record hand-overs waiting for the registrar, newest first. */
export async function listSurrenders(status?: "pending" | "received"): Promise<RegistrarSurrenderRow[]> {
  await requireModule("registrar");
  const surrenderedBy = alias(user, "surrendered_by");
  const receivedBy = alias(user, "received_by");
  const rows = await getDb()
    .select({
      id: recordSurrender.id,
      studentId: student.id,
      studentName: sql<string>`${student.surname} || ', ' || ${student.firstname}`,
      lrn: student.lrn,
      className: schoolClass.name,
      reason: recordSurrender.reason,
      status: recordSurrender.status,
      note: recordSurrender.note,
      surrenderedAt: recordSurrender.surrenderedAt,
      receivedAt: recordSurrender.receivedAt,
      surrenderedByName: surrenderedBy.name,
      receivedByName: receivedBy.name,
    })
    .from(recordSurrender)
    .innerJoin(student, eq(student.id, recordSurrender.studentId))
    .leftJoin(schoolClass, eq(schoolClass.id, recordSurrender.classId))
    .leftJoin(surrenderedBy, eq(surrenderedBy.id, recordSurrender.surrenderedBy))
    .leftJoin(receivedBy, eq(receivedBy.id, recordSurrender.receivedBy))
    .where(status ? eq(recordSurrender.status, status) : undefined)
    .orderBy(desc(recordSurrender.surrenderedAt))
    .limit(100);
  return rows;
}

export interface ParentLinkSummaryRow {
  id: string;
  studentId: string;
  studentName: string;
  lrn: string;
  parentName: string;
  parentEmail: string;
  relationship: string;
}

/** Parent accounts and the children they can open. */
export async function listParentLinks(): Promise<ParentLinkSummaryRow[]> {
  await requireModule("registrar");
  return getDb()
    .select({
      id: parentLink.id,
      studentId: student.id,
      studentName: sql<string>`${student.surname} || ', ' || ${student.firstname}`,
      lrn: student.lrn,
      parentName: user.name,
      parentEmail: user.email,
      relationship: parentLink.relationship,
    })
    .from(parentLink)
    .innerJoin(student, eq(student.id, parentLink.studentId))
    .innerJoin(user, eq(user.id, parentLink.userId))
    .orderBy(asc(sql`lower(${student.surname})`), asc(sql`lower(${student.firstname})`))
    .limit(200);
}

/** Class enrolments with the number of students, for card printing lists. */
export async function listClassesForCards(): Promise<{ id: string; name: string; students: number }[]> {
  await requireModule("registrar");
  return getDb()
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      students: sql<number>`count(${enrollment.studentId})`.mapWith(Number),
    })
    .from(schoolClass)
    .leftJoin(enrollment, eq(enrollment.classId, schoolClass.id))
    .groupBy(schoolClass.id, schoolClass.name)
    .orderBy(sql`lower(${schoolClass.name})`);
}

export interface CardStudentRow {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  className: string | null;
  gradeLevelName: string | null;
}

/** Students the registrar can print a card for, optionally filtered by name or LRN. */
export async function listStudentsForCards(query = ""): Promise<CardStudentRow[]> {
  await requireModule("registrar");
  const q = query.trim();
  const rows = await getDb()
    .select({
      id: student.id,
      lrn: student.lrn,
      surname: student.surname,
      firstname: student.firstname,
      middlename: student.middlename,
      className: schoolClass.name,
      gradeLevelName: gradeLevel.name,
    })
    .from(student)
    .leftJoin(enrollment, eq(enrollment.studentId, student.id))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .leftJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .where(
      q
        ? or(
            ilike(student.lrn, `%${q}%`),
            ilike(student.surname, `%${q}%`),
            ilike(student.firstname, `%${q}%`),
            ilike(student.middlename, `%${q}%`)
          )
        : undefined
    )
    .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`)
    .limit(300);

  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
