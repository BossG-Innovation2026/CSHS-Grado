"use client";

import { useActionState } from "react";
import {
  approveGrades,
  recordSignedSheet,
  returnGrades,
  verifyGrades,
  type GradeActionState,
} from "../actions";

export function VerificationActions({
  classSubjectId,
  status,
  canVerify,
  canApprove,
  canRecordSheet,
}: {
  classSubjectId: string;
  status: string;
  canVerify: boolean;
  canApprove: boolean;
  canRecordSheet: boolean;
}) {
  const [verifyState, verifyAction, verifying] = useActionState<GradeActionState, FormData>(verifyGrades, {});
  const [approveState, approveAction, approving] = useActionState<GradeActionState, FormData>(approveGrades, {});
  const [returnState, returnAction, returning] = useActionState<GradeActionState, FormData>(returnGrades, {});
  const [sheetState, sheetAction, savingSheet] = useActionState<GradeActionState, FormData>(recordSignedSheet, {});

  const canReturn = (canVerify || canApprove) && (status === "submitted" || status === "verified");

  return (
    <div className="space-y-5 p-4">
      {(canVerify || canApprove) && (
        <div className="flex flex-wrap items-center gap-2">
          {canVerify && (
            <form action={verifyAction}>
              <input type="hidden" name="classSubjectId" value={classSubjectId} />
              <button
                type="submit"
                disabled={verifying}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Verify grades"}
              </button>
            </form>
          )}
          {canApprove && (
            <form action={approveAction}>
              <input type="hidden" name="classSubjectId" value={classSubjectId} />
              <button
                type="submit"
                disabled={approving}
                className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                {approving ? "Approving…" : "Approve and lock"}
              </button>
            </form>
          )}
        </div>
      )}

      {verifyState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{verifyState.error}</p>}
      {verifyState.message && <p className="text-sm text-accent-strong">{verifyState.message}</p>}
      {approveState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{approveState.error}</p>}
      {approveState.message && <p className="text-sm text-accent-strong">{approveState.message}</p>}

      {canReturn && (
        <form action={returnAction} className="rounded-md border border-border bg-panel/50 p-3">
          <input type="hidden" name="classSubjectId" value={classSubjectId} />
          <label htmlFor="return-note" className="block text-xs font-medium text-foreground">
            Return for correction
          </label>
          <textarea
            id="return-note"
            name="note"
            rows={2}
            placeholder="Explain what the teacher must correct…"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {returnState.error ? (
              <p className="text-xs text-rose-600 dark:text-rose-300">{returnState.error}</p>
            ) : returnState.message ? (
              <p className="text-xs text-accent-strong">{returnState.message}</p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={returning}
              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              {returning ? "Returning…" : "Return to teacher"}
            </button>
          </div>
        </form>
      )}

      {canRecordSheet && (
        <form action={sheetAction} className="rounded-md border border-border p-3">
          <input type="hidden" name="classSubjectId" value={classSubjectId} />
          <p className="text-xs font-medium text-foreground">Signed grading sheet received</p>
          <p className="mt-0.5 text-xs text-muted">
            File the paper copy as the backup reference for this subject.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              name="referenceNo"
              placeholder="Reference no."
              className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
            <input
              name="note"
              placeholder="Note (optional)"
              className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingSheet}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              {savingSheet ? "Saving…" : "Record sheet"}
            </button>
          </div>
          {sheetState.error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{sheetState.error}</p>}
          {sheetState.message && <p className="mt-1 text-xs text-accent-strong">{sheetState.message}</p>}
        </form>
      )}
    </div>
  );
}
