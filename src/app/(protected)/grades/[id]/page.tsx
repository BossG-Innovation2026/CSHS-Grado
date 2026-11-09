import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { TERM_LABELS, type Term } from "@/lib/terms";
import { findSheet } from "@/server/grades";
import { BackLink, EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui";
import { GradeSheetForm } from "./grade-sheet-form";
import { VerificationActions } from "./verification-actions";

export const dynamic = "force-dynamic";

export default async function GradeSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  if (!can(user, "grades_submit") && !can(user, "grades_approve")) redirect("/dashboard");
  const sheet = await findSheet(user, id);
  const backHref = can(user, "grades_submit") ? "/grades" : "/grades/verify";

  if (!sheet) {
    return (
      <div>
        <BackLink href={backHref}>Back</BackLink>
        <p className="mt-3 text-sm text-muted">Subject sheet not found, or you do not have access to it.</p>
      </div>
    );
  }

  const { offering, submission } = sheet;
  const canRecordSheet = can(user, "registrar");
  const showActions = sheet.canVerify || sheet.canApprove || canRecordSheet;

  return (
    <div>
      <BackLink href={backHref}>Back</BackLink>
      <div className="mt-2">
        <PageHeader
          title={`${offering.className} · ${offering.code}`}
          description={`${offering.title} · ${TERM_LABELS[offering.term as Term] ?? `Term ${offering.term}`} · Subject teacher: ${
            offering.teacherName ?? "—"
          } · Adviser: ${offering.adviserName}`}
          actions={<StatusPill status={submission.status} />}
        />
      </div>

      {submission.status === "returned" && submission.returnNote && (
        <div className="mt-5 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          <p className="font-semibold">Returned for correction</p>
          <p className="mt-1">{submission.returnNote}</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 text-xs text-muted sm:grid-cols-3">
        <p>Submitted: {submission.submittedAt ? submission.submittedAt.toLocaleString("en-PH") : "—"}</p>
        <p>Adviser verified: {submission.adviserVerifiedAt ? submission.adviserVerifiedAt.toLocaleString("en-PH") : "—"}</p>
        <p>Registrar approved: {submission.registrarVerifiedAt ? submission.registrarVerifiedAt.toLocaleString("en-PH") : "—"}</p>
      </div>

      <div className="mt-5">
        <Panel
          title="Grades"
          description={`${offering.encodedCount} of ${offering.studentCount} student(s) encoded. A grade of 75 or higher is passing.`}
        >
          <GradeSheetForm offering={offering} students={sheet.students} canEncode={sheet.canEncode} />
        </Panel>
      </div>

      {showActions && (
        <div className="mt-5">
          <Panel
            title="Verification and approval"
            description="Verify the encoding, return it with a note, or (as registrar) approve and lock it. Record the signed paper sheet here too."
          >
            <VerificationActions
              classSubjectId={offering.id}
              status={submission.status}
              canVerify={sheet.canVerify}
              canApprove={sheet.canApprove}
              canRecordSheet={canRecordSheet}
            />
          </Panel>
        </div>
      )}

      <div className="mt-5">
        <Panel title="Signed grading sheets on file" description="Paper copies kept by the registrar as a backup reference.">
          <ul className="divide-y divide-border text-sm">
            {sheet.sheets.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-foreground">{s.referenceNo || "No reference number"}</span>
                <span className="text-xs text-muted">
                  {s.receivedAt.toLocaleDateString("en-PH")}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {sheet.sheets.length === 0 && <EmptyState title="No signed sheet filed yet" />}
        </Panel>
      </div>
    </div>
  );
}
