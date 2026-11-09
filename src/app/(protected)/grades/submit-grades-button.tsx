"use client";

import { useActionState, useState } from "react";
import { submitFinalGrades, type ActionState } from "./actions";

export function SubmitGradesButton({ classSubjectId }: { classSubjectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitFinalGrades, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Submit this term</h2>
      <p className="mt-1 text-xs text-muted">
        Save your grades first. Submitting sends them to the class adviser and locks this sheet unless it is returned.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
      >
        Submit grades
      </button>
      {state.error && (
        <div className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
          <p>{state.error}</p>
          {state.problems && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submit grades confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            action={action}
            onSubmit={() => setOpen(false)}
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg"
          >
            <input type="hidden" name="classSubjectId" value={classSubjectId} />
            <h3 className="text-sm font-semibold text-foreground">Submit these grades?</h3>
            <p className="mt-1 text-xs text-muted">Unsaved changes are not included. You can&apos;t edit after this unless the grades are returned.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
