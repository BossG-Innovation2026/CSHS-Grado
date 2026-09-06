"use client";

import { useActionState } from "react";
import { bulkAddSubjects, type BulkSubjectResult } from "./actions";

export function BulkUploadSubjectsForm({ gradeLevelId }: { gradeLevelId: string }) {
  const [state, action, pending] = useActionState<BulkSubjectResult, FormData>(
    (prev, formData) => bulkAddSubjects(formData),
    { added: 0, skipped: 0, invalid: 0, errors: [] }
  );

  return (
    <div className="mt-4 max-w-3xl rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Bulk add subjects</h2>
      <p className="mt-1 text-xs text-muted">
        Download the Excel template, fill in subjects, and upload here.
      </p>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <a
          href="/curriculum/template.xlsx"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-panel-hover"
        >
          Download template
        </a>
      </div>
      <form action={action} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <input type="hidden" name="gradeLevelId" value={gradeLevelId} />
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-panel-hover file:px-3 file:py-1 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50 sm:col-span-1"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      {state.errors.length > 0 && !state.errors.some((e) => e.startsWith("You are not")) && (
        <div className="mt-3 rounded-md bg-accent-soft p-3">
          <p className="text-sm text-foreground">{state.errors.join(" ")}</p>
        </div>
      )}
      {state.errors.some((e) => e.startsWith("You are not")) && (
        <div className="mt-3 rounded-md bg-accent-soft p-3">
          <p className="text-sm text-foreground">{state.errors[0]}</p>
        </div>
      )}
      {(state.added > 0 || state.skipped > 0 || state.invalid > 0) && (
        <div className="mt-3 rounded-md bg-accent-soft p-3">
          <p className="text-sm text-foreground">
            Added {state.added}. Skipped {state.skipped} duplicates. Invalid: {state.invalid}.
          </p>
        </div>
      )}
    </div>
  );
}
