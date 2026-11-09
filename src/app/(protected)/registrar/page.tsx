import Link from "next/link";
import { can, requireModule } from "@/lib/access";
import { TERM_LABELS, type Term } from "@/lib/terms";
import { listVerificationQueue } from "@/server/grades";
import { getRegistrarSummary, listParentLinks, listSurrenders } from "@/server/registrar";
import { EmptyState, PageHeader, Panel, Stat, StatusPill } from "@/components/ui";
import { ReceiveRecordForm } from "./receive-record";

export const dynamic = "force-dynamic";

export default async function RegistrarPage() {
  const user = await requireModule("registrar");
  const canApprove = can(user, "grades_approve");

  const [summary, pending, received, parentLinks, queue] = await Promise.all([
    getRegistrarSummary(),
    listSurrenders("pending"),
    listSurrenders("received"),
    listParentLinks(),
    canApprove ? listVerificationQueue() : Promise.resolve([]),
  ]);

  const needingAction = queue.filter((q) => q.status === "submitted" || q.status === "verified");

  return (
    <div>
      <PageHeader
        title="Registrar Office"
        description="Final approval of grades, permanent-record custody, parent access, Form 137 and report-card printing."
        actions={
          <>
            <Link
              href="/registrar/cards"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-hover"
            >
              Print cards
            </Link>
            <Link
              href="/audit"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-hover"
            >
              Audit log
            </Link>
          </>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={summary.students} hint={`${summary.classes} classes · ${summary.subjects} subjects`} href="/students" />
        <Stat
          label="Awaiting action"
          value={summary.submitted + summary.verified}
          hint={`${summary.submitted} to verify · ${summary.verified} to approve`}
          href="/grades/verify"
        />
        <Stat
          label="Records to receive"
          value={summary.pendingSurrenders}
          hint={`${summary.returned} sheet(s) returned for correction`}
        />
        <Stat
          label="Filed"
          value={summary.approved}
          hint={`${summary.signedSheets} signed sheet(s) · ${summary.parentLinks} parent link(s)`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Records handed over by advisers"
          description="The adviser keeps the permanent record until it is surrendered to this office."
        >
          <div className="divide-y divide-border">
            {pending.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/students/${row.studentId}`} className="font-medium text-foreground hover:underline">
                    {row.studentName}
                  </Link>
                  <p className="text-xs text-muted">
                    LRN {row.lrn} · {row.className ?? "No class"} · {row.reason}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                  <p className="text-[11px] text-subtle">
                    Surrendered {row.surrenderedAt.toLocaleDateString("en-PH")} by {row.surrenderedByName ?? "—"}
                  </p>
                </div>
                <ReceiveRecordForm surrenderId={row.id} />
              </div>
            ))}
            {pending.length === 0 && (
              <EmptyState title="No records waiting" hint="Surrenders from class advisers appear here." />
            )}
          </div>
        </Panel>

        <Panel
          title="Grade sheets needing the registrar"
          description="Final approval after the adviser verifies the encoding."
          actions={
            <Link href="/grades/verify" className="text-sm text-accent-strong hover:underline">
              Open queue
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Class / subject</th>
                  <th className="px-4 py-3">Term</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {needingAction.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{o.className}</p>
                      <p className="text-xs text-muted">
                        {o.code} · {o.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{TERM_LABELS[o.term as Term] ?? `Term ${o.term}`}</td>
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
          {needingAction.length === 0 && (
            <EmptyState title="Nothing waiting" hint="Verified sheets appear here for final approval." />
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Parent portal access"
          description="Which parent account can open which child's approved card."
          actions={
            <Link href="/students" className="text-sm text-accent-strong hover:underline">
              Manage links
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {parentLinks.slice(0, 10).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{row.parentName}</p>
                  <p className="text-xs text-muted">{row.parentEmail}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <Link href={`/students/${row.studentId}`} className="text-accent-strong hover:underline">
                    {row.studentName}
                  </Link>
                  <p>
                    {row.relationship} · LRN {row.lrn}
                  </p>
                </div>
              </div>
            ))}
            {parentLinks.length === 0 && (
              <EmptyState title="No parent accounts linked" hint="Create a parent account, then link it from the student record." />
            )}
          </div>
        </Panel>

        <Panel
          title="Recently received records"
          description="Permanent records now filed in the registrar office."
        >
          <div className="divide-y divide-border">
            {received.slice(0, 10).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <Link href={`/students/${row.studentId}`} className="font-medium text-foreground hover:underline">
                    {row.studentName}
                  </Link>
                  <p className="text-xs text-muted">
                    LRN {row.lrn} · {row.className ?? "No class"} · {row.reason}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {row.receivedAt ? row.receivedAt.toLocaleDateString("en-PH") : "—"} · by {row.receivedByName ?? "—"}
                </p>
              </div>
            ))}
            {received.length === 0 && <EmptyState title="No records filed yet" />}
          </div>
        </Panel>
      </div>
    </div>
  );
}
