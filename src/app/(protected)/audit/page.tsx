import { requireModule } from "@/lib/access";
import { listAudit } from "@/server/audit";
import { EmptyState, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireModule("audit");
  const rows = await listAudit(200);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Append-only trail of grade changes, record hand-overs, parent access and personal-information edits."
      />

      <div className="mt-6">
        <Panel title={`${rows.length} recent entr${rows.length === 1 ? "y" : "ies"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {row.createdAt.toLocaleString("en-PH")}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.actorName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-panel-hover px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      <p>{row.entity || "—"}</p>
                      {row.entityId && <p className="text-subtle">{row.entityId.slice(0, 12)}…</p>}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-muted">{row.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <EmptyState title="No audit entries yet" hint="Actions are recorded as staff use the system." />
          )}
        </Panel>
      </div>
    </div>
  );
}
