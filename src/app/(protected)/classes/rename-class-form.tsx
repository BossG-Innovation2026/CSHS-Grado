"use client";

import { useActionState } from "react";
import { renameClass, type ActionState } from "./actions";
import { PasswordConfirmForm } from "./password-confirm-form";

export function RenameClassForm({
  classId,
  name,
  strand,
  schoolYear,
}: {
  classId: string;
  name: string;
  strand: string;
  schoolYear: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameClass, {});

  return (
    <PasswordConfirmForm action={action} className="mt-3 grid gap-2 sm:grid-cols-3 sm:items-end">
      <input type="hidden" name="classId" value={classId} />
      <label>
        <span className="text-xs text-muted">Section name</span>
        <input
          name="name"
          defaultValue={name}
          required
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Strand / track</span>
        <input
          name="strand"
          defaultValue={strand}
          placeholder="e.g. ICT, HUMSS, STEM"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <label>
        <span className="text-xs text-muted">School year</span>
        <input
          name="schoolYear"
          defaultValue={schoolYear}
          placeholder="e.g. 2026-2027"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save section details"}
        </button>
        {state.error && (
          <p className="mt-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
        )}
      </div>
    </PasswordConfirmForm>
  );
}
