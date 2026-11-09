import { Detail, EmptyState, Panel } from "@/components/ui";
import { fullName } from "@/server/students";
import type { StudentCard } from "@/server/cards";

/**
 * Printable report card (SF9). The caller must have checked access: registrar
 * for the office copy, or a parent link check for the parent portal.
 */
export function StudentCardView({
  card,
  title = "Report Card",
  showContact = false,
}: {
  card: StudentCard;
  title?: string;
  showContact?: boolean;
}) {
  const { student } = card;
  return (
    <div className="space-y-5">
      <Panel className="print:border-0 print:shadow-none">
        <div className="p-5 text-center">
          <p className="text-xs uppercase tracking-widest text-muted">Republic of the Philippines</p>
          <h1 className="mt-1 text-lg font-bold text-foreground">{card.school.name || "Project Grado"}</h1>
          {card.school.address && <p className="text-sm text-muted">{card.school.address}</p>}
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-foreground">{title}</p>
          {card.school.schoolId && <p className="text-xs text-muted">School ID: {card.school.schoolId}</p>}
        </div>
        <dl className="grid gap-4 border-t border-border p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Student" value={fullName(student)} />
          <Detail label="LRN" value={student.lrn} />
          <Detail label="Sex" value={student.sex} />
          <Detail label="Date of birth" value={student.birthDate} />
          <Detail label="Grade level" value={card.gradeLevelName ?? "—"} />
          <Detail label="Class" value={card.className ?? "—"} />
          <Detail label="Adviser" value={card.adviserName ?? "—"} />
          {showContact && <Detail label="Parent / guardian" value={student.parentName} />}
          {showContact && <Detail label="Address" value={student.address} />}
        </dl>
      </Panel>

      {card.terms.length > 0 ? (
        card.terms.map((term) => (
          <Panel key={term.term} className="print:break-inside-avoid print:border-0 print:shadow-none">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Term {term.term}</h2>
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
            title="No approved grades yet"
            hint={
              card.approvedOnly
                ? "Grades appear on this card after the registrar approves them."
                : "Encode grades from the subject sheet first."
            }
          />
        </Panel>
      )}

      {card.generalAverage !== null && (
        <Panel className="print:border-0 print:shadow-none">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-semibold text-foreground">General average</span>
            <span className="text-lg font-bold text-accent-strong">{card.generalAverage}</span>
          </div>
        </Panel>
      )}

      <div className="hidden grid-cols-2 gap-10 px-2 pt-10 text-center text-xs text-muted sm:grid print:grid">
        <div className="border-t border-border pt-1">
          <p className="font-semibold text-foreground">{card.adviserName ?? "Class Adviser"}</p>
          <p>Class Adviser</p>
        </div>
        <div className="border-t border-border pt-1">
          <p className="font-semibold text-foreground">{card.school.principal || "School Head"}</p>
          <p>School Head / Principal</p>
        </div>
      </div>
    </div>
  );
}
