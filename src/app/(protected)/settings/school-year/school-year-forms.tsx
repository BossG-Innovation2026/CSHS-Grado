"use client";

import { useActionState } from "react";
import { PasswordConfirmForm } from "../../classes/password-confirm-form";
import { addSchoolYear, saveTermDates, setCurrentSchoolYear, type ActionState } from "./actions";

const INPUT =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";
const BUTTON =
  "rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50";

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{message}</p>;
}

export function AddSchoolYearForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSchoolYear, {});

  return (
    <form action={action} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <label>
        <span className="text-xs text-muted">First day of classes</span>
        <input name="startsOn" type="date" required className={INPUT} />
      </label>
      <label>
        <span className="text-xs text-muted">Last day of classes</span>
        <input name="endsOn" type="date" required className={INPUT} />
      </label>
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Adding…" : "Add school year"}
      </button>
      <div className="sm:col-span-3">
        <ErrorNote message={state.error} />
      </div>
    </form>
  );
}

export function SetCurrentYearForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setCurrentSchoolYear, {});

  return (
    <PasswordConfirmForm action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-panel-hover disabled:opacity-50"
      >
        {pending ? "Switching…" : "Make current"}
      </button>
      <ErrorNote message={state.error} />
    </PasswordConfirmForm>
  );
}

export interface TermDates {
  term: number;
  startsOn: string | null;
  endsOn: string | null;
  submissionDeadline: string | null;
}

export function TermDatesForm({ id, terms }: { id: string; terms: TermDates[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTermDates, {});

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={id} />
      {terms.map((t) => (
        <div key={t.term} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
          <p className="text-sm font-medium text-foreground">Term {t.term}</p>
          <label>
            <span className="text-xs text-muted">Starts</span>
            <input name={`startsOn${t.term}`} type="date" defaultValue={t.startsOn ?? ""} className={INPUT} />
          </label>
          <label>
            <span className="text-xs text-muted">Ends</span>
            <input name={`endsOn${t.term}`} type="date" defaultValue={t.endsOn ?? ""} className={INPUT} />
          </label>
          <label>
            <span className="text-xs text-muted">Grades due</span>
            <input
              name={`deadline${t.term}`}
              type="date"
              defaultValue={t.submissionDeadline ?? ""}
              className={INPUT}
            />
          </label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Saving…" : "Save term dates"}
        </button>
        {state.ok && !pending && <p className="text-sm text-muted">Saved.</p>}
      </div>
      <ErrorNote message={state.error} />
    </form>
  );
}
