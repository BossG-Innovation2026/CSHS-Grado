import Link from "next/link";
import { can, isAdmin, requireModule } from "@/lib/access";
import {
  canEditStudentInfo,
  canViewContactInfo,
  fullName,
  getStudent,
  listAcademicRecords,
  listParentAccounts,
  listStudentClasses,
  listStudentGrades,
  listStudentParents,
  listSurrendersForStudent,
} from "@/server/students";
import { BackLink, Detail, EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui";
import { StudentInfoForm } from "../student-info-form";
import { ParentAccess } from "../parent-access";
import { RecordCustody } from "../record-custody";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("personal_info");
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) {
    return (
      <div>
        <BackLink href="/students">Back to students</BackLink>
        <p className="mt-3 text-sm text-muted">Student not found, or you do not have access to this record.</p>
      </div>
    );
  }

  const canEdit = canEditStudentInfo(user);
  const showContact = canViewContactInfo(user);
  const showAcademic = can(user, "academic_info");
  const [classes, grades, parents, surrenders, parentAccounts, academic] = await Promise.all([
    listStudentClasses(id),
    listStudentGrades(id),
    listStudentParents(id),
    listSurrendersForStudent(id),
    canEdit ? listParentAccounts() : Promise.resolve([]),
    showAcademic ? listAcademicRecords(id) : Promise.resolve([]),
  ]);

  const canSurrender = isAdmin(user) || classes.some((c) => c.adviserId === user.id);
  const canReceive = can(user, "registrar");

  const byTerm = new Map<number, typeof grades>();
  for (const g of grades) {
    if (!byTerm.has(g.term)) byTerm.set(g.term, []);
    byTerm.get(g.term)!.push(g);
  }

  return (
    <div>
      <BackLink href="/students">Back to students</BackLink>
      <div className="mt-2">
        <PageHeader
          title={fullName(student)}
          description={`LRN ${student.lrn} · ${classes[0] ? `${classes[0].gradeLevelName} · ${classes[0].className}` : "Not enrolled"}`}
          actions={
            <>
              {showAcademic && (
                <Link
                  href={`/academic/${student.id}`}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-hover"
                >
                  Academic record
                </Link>
              )}
              {can(user, "registrar") && (
                <Link
                  href={`/registrar/cards/${student.id}`}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
                >
                  Print card
                </Link>
              )}
            </>
          }
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Personal information">
          {canEdit ? (
            <StudentInfoForm student={student} />
          ) : (
            <dl className="grid gap-4 p-4 sm:grid-cols-2">
              <Detail label="Complete name" value={fullName(student)} />
              <Detail label="LRN" value={student.lrn} />
              <Detail label="Sex" value={student.sex} />
              <Detail label="Date of birth" value={student.birthDate} />
              {showContact && (
                <>
                  <Detail label="Parent / guardian" value={student.parentName} />
                  <Detail label="Parent contact" value={student.parentContact} />
                  <Detail label="Address" value={student.address} />
                </>
              )}
            </dl>
          )}
        </Panel>

        <Panel title="Class record">
          <div className="divide-y divide-border">
            {classes.map((c) => (
              <div key={c.classId} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{c.className}</p>
                  <p className="text-xs text-muted">{c.gradeLevelName}</p>
                </div>
                <Link href={`/classes/${c.classId}`} className="text-xs text-accent-strong hover:underline">
                  Class page
                </Link>
              </div>
            ))}
            {classes.length === 0 && <EmptyState title="Not enrolled in a class" />}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Grades" description="Every encoded grade across terms, with the current verification status.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Remark</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...byTerm.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .flatMap(([term, rows]) =>
                    rows.map((g, index) => (
                      <tr key={`${term}-${g.subjectCode}-${index}`}>
                        <td className="px-4 py-3 text-muted">Term {term}</td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{g.subjectTitle}</p>
                          <p className="text-xs text-subtle">{g.subjectCode}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{g.value ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {g.value === null ? "—" : g.value >= 75 ? "Passed" : "Failed"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={g.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{g.teacherName ?? "—"}</td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
          {grades.length === 0 && <EmptyState title="No grades encoded yet" />}
        </Panel>
      </div>

      {showAcademic && (
        <div className="mt-5">
          <Panel
            title="Academic information"
            description="Previous-school (junior high school) records that feed the permanent record (Form 137)."
            actions={
              <Link href={`/academic/${student.id}`} className="text-sm text-accent-strong hover:underline">
                Open full record
              </Link>
            }
          >
            <div className="divide-y divide-border">
              {academic.map((r) => (
                <div key={r.id} className="px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    {r.schoolName} · {r.gradeLevel || "—"}
                  </p>
                  <p className="text-xs text-muted">
                    SY {r.schoolYear || "—"} · General average {r.generalAverage || "—"}
                    {r.completed ? " · Completed" : ""}
                  </p>
                </div>
              ))}
              {academic.length === 0 && <EmptyState title="No previous-school record yet" />}
            </div>
          </Panel>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Parent portal access"
          description="A linked parent account can see this student's approved cards only."
        >
          {canEdit ? (
            <ParentAccess studentId={student.id} parents={parentAccounts} links={parents} />
          ) : (
            <div className="p-4 text-sm text-muted">
              {parents.length > 0
                ? `${parents.length} parent account(s) linked. Only the registrar can change access.`
                : "No parent account is linked. Contact the registrar office."}
            </div>
          )}
        </Panel>

        <Panel
          title="Permanent record custody"
          description="The adviser holds the record until it is surrendered to the registrar."
        >
          <RecordCustody
            studentId={student.id}
            canSurrender={canSurrender}
            canReceive={canReceive}
            surrenders={surrenders}
          />
        </Panel>
      </div>
    </div>
  );
}
