import Link from "next/link";
import { requireModule } from "@/lib/access";
import { TERM_LABELS, type Term } from "@/lib/terms";
import { listVerificationQueue } from "@/server/grades";
import { EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VerifyGradesPage() {
  await requireModule("grades_approve");
  const offerings = await listVerificationQueue();

  return (
    <div>
      <PageHeader
        title="Grade Verification"
        description="Advisers check the encoding of their own classes. School Heads and Department Heads check all classes. The registrar gives final approval after verification."
      />

      <div className="mt-6">
        <Panel title="Sheets" description="Only submitted sheets need action; approved sheets are locked.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Teacher / adviser</th>
                  <th className="px-4 py-3">Encoded</th>
                  <th className="px-4 py-3">Status</th>
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
                    <td className="px-4 py-3 text-xs text-muted">
                      <p>Teacher: {o.teacherName ?? "—"}</p>
                      <p>Adviser: {o.adviserName}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {o.encodedCount}/{o.studentCount}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/grades/${o.id}`} className="text-accent-strong hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {offerings.length === 0 && <EmptyState title="Nothing to verify yet" hint="Submitted sheets appear here." />}
        </Panel>
      </div>
    </div>
  );
}
