"use client";

import { useActionState } from "react";
import { uploadFinalGrades, type ActionState } from "./actions";

export function UploadGradesForm({ classSubjectId }: { classSubjectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadFinalGrades, {});

  return (
    <form action={action} className="rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="classSubjectId" value={classSubjectId} />
      <h2 className="text-sm font-semibold text-foreground">Upload from Excel</h2>
      <p className="mt-1 text-xs text-muted">
        Use Download Excel above, fill in the Final Grade column, and upload it here. Blank cells keep the saved grade.
      </p>
      <input
        type="file"
        name="file"
        accept=".xlsx"
        required
        className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-panel-hover file:px-3 file:py-1 file:text-sm file:text-foreground"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-panel-hover disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload grades"}
      </button>
      {(state.error || state.message) && (
        <div className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
          <p>{state.error ?? state.message}</p>
          {state.problems && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
