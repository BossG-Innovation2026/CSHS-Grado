import Link from "next/link";
import { requireModule } from "@/lib/access";
import { isAdmin } from "@/lib/access";
import { TERMS, type Term } from "@/lib/terms";
import {
  getClass,
  listActiveTeachers,
  listClassSubjects,
  listStudents,
  listSubjectsByGrade,
} from "../actions";
import { RenameClassForm } from "../rename-class-form";
import { AddClassSubjectForm } from "../add-class-subject-form";
import { EnrollStudentForm } from "../enroll-student-form";
import { UploadStudentsForm, DownloadStudentTemplate } from "../upload-students-form";
import { SubjectTeacherSelect } from "../subject-teacher-select";
import { RemoveClassSubjectButton } from "../remove-class-subject-button";
import { UnenrollStudentButton } from "../unenroll-student-button";
import { DeleteClassDialog } from "../delete-class-dialog";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireModule("classes");
  const { id } = await params;
  const { term: termParam } = await searchParams;

  const cls = await getClass(id);
  if (!cls) {
    return (
      <div>
        <p className="text-sm text-muted">Class not found.</p>
        <Link href="/classes" className="mt-2 inline-block text-sm text-accent-strong hover:underline">
          ← Back to classes
        </Link>
      </div>
    );
  }

  const term = TERMS.includes(Number(termParam) as Term) ? (Number(termParam) as Term) : 1;
  const [subjects, teachers, students, curriculumSubjects] = await Promise.all([
    listClassSubjects(id, term),
    listActiveTeachers(),
    listStudents(id),
    listSubjectsByGrade(cls.gradeLevelId),
  ]);

  const canEdit = isAdmin(user) || cls.adviserId === user.id;
  const inClass = new Set(subjects.map((s) => s.subjectId));
  const availableSubjects = curriculumSubjects.filter((s) => !inClass.has(s.id));

  return (
    <div>
      <Link href="/classes" className="text-sm text-accent-strong hover:underline">
        ← Back to classes
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{cls.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {cls.gradeLevelName} · Adviser: <span className="text-foreground">{cls.adviserName}</span>
          </p>
        </div>
        {canEdit && <DeleteClassDialog classId={cls.id} className={cls.name} />}
      </div>

      {canEdit && (
        <div className="mt-6 max-w-md rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Rename section</h2>
          <RenameClassForm classId={cls.id} name={cls.name} />
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Subjects</h2>
              <p className="mt-0.5 text-xs text-muted">
                Set up the subjects taught in each term. Terms 2 and 3 can be filled now or later.
              </p>
            </div>
            <div className="flex gap-1 rounded-md bg-panel p-1">
              {TERMS.map((t) => (
                <Link
                  key={t}
                  href={`/classes/${cls.id}?term=${t}`}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    t === term
                      ? "bg-accent text-on-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Term {t}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Subject teacher</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-accent-strong">{s.code}</td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{s.title}</p>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-subtle">{s.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <SubjectTeacherSelect
                      classSubjectId={s.id}
                      teacherId={s.teacherId}
                      teachers={teachers}
                    />
                  ) : (
                    <span className="text-sm text-foreground">{s.teacherName ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit && <RemoveClassSubjectButton id={s.id} />}
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-subtle">
                  No subjects set up for Term {term} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canEdit && (
          <div className="border-t border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Add subject to Term {term}</h3>
            {availableSubjects.length === 0 ? (
              <p className="mt-2 text-sm text-subtle">
                All curriculum subjects of {cls.gradeLevelName} are already in this term.
              </p>
            ) : (
              <AddClassSubjectForm
                classId={cls.id}
                term={term}
                subjects={availableSubjects}
                teachers={teachers}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Students</h2>
              <p className="mt-0.5 text-xs text-muted">
                Enrolled students of {cls.name}. Download the template, fill it in, then upload to
                enroll them in bulk — or add them one by one.
              </p>
            </div>
            {canEdit && (
              <DownloadStudentTemplate />
            )}
          </div>
        </div>
        {canEdit && (
          <div className="grid grid-cols-1 gap-4 border-b border-border p-4 lg:grid-cols-2">
            <UploadStudentsForm classId={cls.id} />
            <EnrollStudentForm classId={cls.id} />
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">LRN</th>
              <th className="px-4 py-3">Surname</th>
              <th className="px-4 py-3">First name</th>
              <th className="px-4 py-3">Middle name</th>
              <th className="px-4 py-3">Sex</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-accent-strong">{s.lrn}</td>
                <td className="px-4 py-3 text-foreground">{s.surname}</td>
                <td className="px-4 py-3 text-foreground">{s.firstname}</td>
                <td className="px-4 py-3 text-muted">{s.middlename || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">{s.sex}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <UnenrollStudentButton classId={cls.id} studentId={s.id} />
                  )}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                  No students enrolled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
