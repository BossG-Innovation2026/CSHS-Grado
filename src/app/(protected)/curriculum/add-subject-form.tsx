"use client";

import { useActionState } from "react";
import { addSubject, type ActionState } from "./actions";

export function AddSubjectForm({ gradeLevelId }: { gradeLevelId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => addSubject(formData),
    {}
  );

  return (
    <form action={action} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="gradeLevelId" value={gradeLevelId} />
      <label>
        <span className="text-xs text-muted">Subject code</span>
        <input
          name="code"
          required
          placeholder="e.g. GEN-MATH"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <label className="sm:col-span-2">
        <span className="text-xs text-muted">Descriptive title</span>
        <input
          name="title"
          required
          placeholder="e.g. General Mathematics"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Terms to be taught</span>
        <input
          name="terms"
          type="number"
          min={1}
          step={1}
          defaultValue={1}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Credit units</span>
        <input
          name="creditUnits"
          type="number"
          min={1}
          step={1}
          defaultValue={1}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50 sm:col-span-1"
      >
        {pending ? "Adding…" : "Add subject"}
      </button>
      {state.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground sm:col-span-5">
          {state.error}
        </p>
      )}
    </form>
  );
}
