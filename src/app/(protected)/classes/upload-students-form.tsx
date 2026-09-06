"use client";

import { useActionState } from "react";
import { enrollFromTemplate, type ActionState } from "./actions";
import { PasswordConfirmForm } from "./password-confirm-form";

export function UploadStudentsForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(enrollFromTemplate, {});

  return (
    <PasswordConfirmForm action={action} className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Upload template</h3>
      <p className="text-xs text-muted">
        Fill the downloaded Excel template with students and upload here. Students are matched by
        LRN; already-enrolled ones are skipped.
      </p>
      <input type="hidden" name="classId" value={classId} />
      <div className="flex items-center gap-2">
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
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {state.message && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.message}</p>
      )}
      {state.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
      )}
    </PasswordConfirmForm>
  );
}