import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import type { SubmissionStatus } from "@/lib/grades";
import { listMyOfferings, type SubjectOffering } from "@/server/grades";

const { schoolClass, gradeLevel, enrollment, student, classSubject, grade, gradeSubmission } = schema;

/** The information the teacher dashboard may show. Contact details stay private. */
export interface TeacherDashboardStudent {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  sex: string;
  birthDate: string;
}

export interface TeacherAdvisory {
  id: string;
  name: string;
  gradeLevelName: string;
  strand: string;
  schoolYear: string;
}

export interface TeacherAssessment {
  studentId: string;
  term: number;
  className: string;
  strand: string;
  schoolYear: string;
  gradeLevelName: string;
  subjectCode: string;
  subjectTitle: string;
  value: number | null;
  writtenWork: number | null;
  performanceTask: number | null;
  otherAssessment: number | null;
  status: SubmissionStatus;
}

export interface TeacherGradeStudent extends TeacherDashboardStudent {
  gradeValue: number | null;
  writtenWork: number | null;
  performanceTask: number | null;
  otherAssessment: number | null;
}

export interface TeacherDashboardData {
  teacherId: string;
  advisory: TeacherAdvisory | null;
  students: TeacherDashboardStudent[];
  assessments: TeacherAssessment[];
  offerings: SubjectOffering[];
  gradesByOffering: Record<string, TeacherGradeStudent[]>;
}

/**
 * Everything the signed-in teacher's dashboard needs, in a small number of
 * queries. Access follows the same rules as the grade sheets: only subjects
 * the teacher teaches, plus the advisory class they are responsible for.
 */
export async function getTeacherDashboard(): Promise<TeacherDashboardData> {
  const actor = await requireModule("grades_submit");

  const [advisoryRow] = await getDb()
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      gradeLevelName: gradeLevel.name,
      strand: schoolClass.strand,
      schoolYear: schoolClass.schoolYear,
    })
    .from(schoolClass)
    .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
    .where(eq(schoolClass.adviserId, actor.id))
    .orderBy(asc(gradeLevel.sortOrder), sql`lower(${schoolClass.name})`)
    .limit(1);

  const students = advisoryRow
    ? await getDb()
        .select({
          id: student.id,
          lrn: student.lrn,
          surname: student.surname,
          firstname: student.firstname,
          middlename: student.middlename,
          sex: student.sex,
          birthDate: student.birthDate,
        })
        .from(enrollment)
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .where(eq(enrollment.classId, advisoryRow.id))
        .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`)
    : [];

  const studentIds = students.map((s) => s.id);
  const assessments =
    studentIds.length > 0
      ? await getDb()
          .select({
            studentId: grade.studentId,
            term: classSubject.term,
            className: schoolClass.name,
            strand: schoolClass.strand,
            schoolYear: schoolClass.schoolYear,
            gradeLevelName: gradeLevel.name,
            subjectCode: classSubject.code,
            subjectTitle: classSubject.title,
            value: grade.value,
            writtenWork: grade.writtenWork,
            performanceTask: grade.performanceTask,
            otherAssessment: grade.otherAssessment,
            status: sql<SubmissionStatus>`coalesce(${gradeSubmission.status}, 'draft')`,
          })
          .from(grade)
          .innerJoin(classSubject, eq(classSubject.id, grade.classSubjectId))
          .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
          .innerJoin(gradeLevel, eq(gradeLevel.id, schoolClass.gradeLevelId))
          .leftJoin(gradeSubmission, eq(gradeSubmission.classSubjectId, classSubject.id))
          .where(inArray(grade.studentId, studentIds))
          .orderBy(
            asc(classSubject.term),
            sql`lower(${classSubject.title})`,
            sql`lower(${schoolClass.name})`
          )
      : [];

  const offerings = await listMyOfferings();
  const offeringIds = offerings.map((o) => o.id);
  const gradeRows =
    offeringIds.length > 0
      ? await getDb()
          .select({
            offeringId: classSubject.id,
            id: student.id,
            lrn: student.lrn,
            surname: student.surname,
            firstname: student.firstname,
            middlename: student.middlename,
            sex: student.sex,
            birthDate: student.birthDate,
            gradeValue: grade.value,
            writtenWork: grade.writtenWork,
            performanceTask: grade.performanceTask,
            otherAssessment: grade.otherAssessment,
          })
          .from(classSubject)
          .innerJoin(enrollment, eq(enrollment.classId, classSubject.classId))
          .innerJoin(student, eq(student.id, enrollment.studentId))
          .leftJoin(
            grade,
            and(eq(grade.classSubjectId, classSubject.id), eq(grade.studentId, student.id))
          )
          .where(inArray(classSubject.id, offeringIds))
          .orderBy(sql`lower(${student.surname})`, sql`lower(${student.firstname})`)
      : [];

  const gradesByOffering: Record<string, TeacherGradeStudent[]> = {};
  for (const row of gradeRows) {
    const { offeringId, ...gradeStudent } = row;
    if (!gradesByOffering[offeringId]) gradesByOffering[offeringId] = [];
    gradesByOffering[offeringId].push(gradeStudent);
  }

  return {
    teacherId: actor.id,
    advisory: advisoryRow ?? null,
    students,
    assessments,
    offerings,
    gradesByOffering,
  };
}
