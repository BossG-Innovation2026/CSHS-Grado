import { isAdmin, requireModule, ROLE_REGISTRAR } from "@/lib/access";
import { buildStudentCard } from "@/server/cards";
import {
  canViewStudent,
  findStudent,
  fullName,
  listAcademicRecords,
} from "@/server/students";
import { BackLink, Detail, EmptyState, PageHeader, Panel } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { AcademicRecordForm } from "../academic-record-form";

export const dynamic = "force-dynamic";

export default async function AcademicRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("academic_info");
  const { id } = await params;
  const student = await findStudent(id);
  if (!student || !(await canViewStudent(user, id))) {
    return (
      <div>
        <BackLink href="/academic">Back</BackLink>
        <p className="mt-3 text-sm text-muted">Student not found, or you do not have access to this record.</p>
      </div>
    );
  }

  const canEdit = isAdmin(user) || user.role === ROLE_REGISTRAR;
  const [records, card] = await Promise.all([
    listAcademicRecords(id),
    buildStudentCard(id, { approvedOnly: true }),
  ]);

  return (
    <div>
      <div className="print:hidden">
        <BackLink href="/academic">Back to academic information</BackLink>
        <div className="mt-2">
          <PageHeader
            title={`${fullName(student)} — Form 137`}
            description="Permanent record: junior high school history and approved senior high grades."
            actions={<PrintButton label="Print Form 137" />}
          />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Panel className="print:border-0 print:shadow-none">
          <div className="p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-muted">Republic of the Philippines</p>
            <h1 className="mt-1 text-lg font-bold text-foreground">{card?.school.name ?? "Project Grado"}</h1>
            {card?.school.address && <p className="text-sm text-muted">{card.school.address}</p>}
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-foreground">
              Permanent Record — Form 137
            </p>
          </div>
          <dl className="grid gap-4 border-t border-border p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Student" value={fullName(student)} />
            <Detail label="LRN" value={student.lrn} />
            <Detail label="Sex" value={student.sex} />
            <Detail label="Date of birth" value={student.birthDate} />
            <Detail label="Class" value={card?.className ?? "—"} />
            <Detail label="Grade level" value={card?.gradeLevelName ?? "—"} />
            <Detail label="Adviser" value={card?.adviserName ?? "—"} />
            <Detail label="School ID" value={card?.school.schoolId ?? "—"} />
          </dl>
        </Panel>

        {card && card.terms.length > 0 ? (
          card.terms.map((term) => (
            <Panel key={term.term} className="print:break-inside-avoid print:border-0 print:shadow-none">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Senior High School — Term {term.term}</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted print:bg-transparent">
                  <tr>
                    <th className="px-4 py-2">Subject</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Grade</th>
                    <th className="px-4 py-2">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {term.rows.map((row, index) => (
                    <tr key={`${term.term}-${row.code}-${index}`}>
                      <td className="px-4 py-2 text-foreground">{row.title}</td>
                      <td className="px-4 py-2 text-muted">{row.code}</td>
                      <td className="px-4 py-2 font-semibold text-foreground">{row.value ?? "—"}</td>
                      <td className="px-4 py-2 text-muted">{row.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ))
        ) : (
          <Panel>
            <EmptyState
              title="No approved senior high grades yet"
              hint="Grades appear on the permanent record after the registrar approves them."
            />
          </Panel>
        )}

        {card?.generalAverage !== null && card?.generalAverage !== undefined && (
          <Panel className="print:border-0 print:shadow-none">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold text-foreground">General average</span>
              <span className="text-lg font-bold text-accent-strong">{card.generalAverage}</span>
            </div>
          </Panel>
        )}

        <Panel
          title="Junior high school / previous school records"
          description="The basis of the permanent record. Each entry keeps the school, year, grade level and subject grades."
          className="print:break-inside-avoid"
        >
          <div className="divide-y divide-border">
            {records.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {r.schoolName} · {r.gradeLevel || "—"}
                    </p>
                    <p className="text-xs text-muted">
                      SY {r.schoolYear || "—"}
                      {r.generalAverage ? ` · General average ${r.generalAverage}` : ""}
                      {r.honors ? ` · ${r.honors}` : ""}
                      {r.completed ? " · Completed" : ""}
                    </p>
                    {r.note && <p className="mt-1 text-xs text-subtle">{r.note}</p>}
                  </div>
                </div>
                {r.subjects.length > 0 && (
                  <table className="mt-2 w-full max-w-xl text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="py-1">Subject</th>
                        <th className="py-1">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.subjects.map((s, index) => (
                        <tr key={`${r.id}-${index}`} className="border-t border-border">
                          <td className="py-1 text-foreground">{s.subject}</td>
                          <td className="py-1 text-muted">{s.grade || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            {records.length === 0 && (
              <EmptyState title="No previous-school record yet" hint="The registrar can add one below." />
            )}
          </div>
          {canEdit && (
            <div className="print:hidden">
              <AcademicRecordForm studentId={student.id} records={records} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
