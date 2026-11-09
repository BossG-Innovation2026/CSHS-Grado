import Link from "next/link";
import { requireModule } from "@/lib/access";
import { TERM_LABELS, type Term } from "@/lib/terms";
import { listMyOfferings } from "@/server/grades";
import { EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function GradesPage() {
  await requireModule("grades_submit");
  const offerings = await listMyOfferings();

  return (
    <div>
      <PageHeader
        title="Grade Submission"
        description="Encode one grade per student for each subject you handle, then submit the sheet. The adviser verifies it and the registrar approves it."
      />

      <div className="mt-6">
        <Panel title="My subject sheets" description="Subjects you teach, plus every subject in a class you advise.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Encoded</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Signed sheet</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {offerings.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{o.className}</td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{o.title}</p>
                      <p className="text-xs text-subtle">{o.code}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{TERM_LABELS[o.term as Term] ?? `Term ${o.term}`}</td>
                    <td className="px-4 py-3 text-muted">
                      {o.encodedCount}/{o.studentCount}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {o.sheetReceivedAt ? o.sheetReceivedAt.toLocaleDateString("en-PH") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/grades/${o.id}`} className="text-accent-strong hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {offerings.length === 0 && (
            <EmptyState
              title="No subject sheets yet"
              hint="Ask the class adviser to assign you as the subject teacher of a class."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
