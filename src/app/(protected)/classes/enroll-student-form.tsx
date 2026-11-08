"use client";

import { useActionState } from "react";
import { enrollStudent, type ActionState } from "./actions";
import { PasswordConfirmForm } from "./password-confirm-form";

export function EnrollStudentForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(enrollStudent, {});

  return (
    <PasswordConfirmForm action={action} className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Enroll individually</h3>
      <p className="text-xs text-muted">
        Add one student at a time. A student already in another class must match that record.
      </p>
      <input type="hidden" name="classId" value={classId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2">
          <span className="text-xs text-muted">LRN</span>
          <input
            name="lrn"
            required
            inputMode="numeric"
            pattern="\d{12}"
            maxLength={12}
            title="12-digit LRN"
            placeholder="e.g. 136789010123"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label>
          <span className="text-xs text-muted">Surname</span>
          <input
            name="surname"
            required
            placeholder="Dela Cruz"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label>
          <span className="text-xs text-muted">First name</span>
          <input
            name="firstname"
            required
            placeholder="Juan"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label>
          <span className="text-xs text-muted">Middle name</span>
          <input
            name="middlename"
            placeholder="Santos"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label>
          <span className="text-xs text-muted">Sex</span>
          <select
            name="sex"
            defaultValue="M"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll student"}
      </button>
      {state.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
      )}
    </PasswordConfirmForm>
  );
}
