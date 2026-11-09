"use client";

import { useActionState } from "react";
import { addClassSubject, type ActionState } from "./actions";
import { PasswordConfirmForm } from "./password-confirm-form";

const weightInput =
  "mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-center text-sm text-foreground focus:border-accent focus:outline-none";

export function AddClassSubjectForm({
  classId,
  term,
  subjects,
  teachers,
}: {
  classId: string;
  term: number;
  subjects: { id: string; code: string; title: string }[];
  teachers: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addClassSubject, {});

  return (
    <PasswordConfirmForm action={action} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="term" value={term} />
      <label>
        <span className="text-xs text-muted">Subject</span>
        <select
          name="subjectId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="" disabled>
            Select…
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.title}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="text-xs text-muted">Description</span>
        <input
          name="description"
          placeholder="e.g. Covers functions and probability"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <label>
        <span className="text-xs text-muted">Subject teacher</span>
        <select
          name="teacherId"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="">— assign later —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="sm:col-span-3">
        <span className="text-xs text-muted">Assessment weights (%) — must total 100</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <label>
            <span className="text-[10px] uppercase tracking-wide text-subtle">Written Works</span>
            <input name="wwWeight" type="number" min={0} max={100} step={1} defaultValue={30} className={weightInput} />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-wide text-subtle">Performance</span>
            <input name="ptWeight" type="number" min={0} max={100} step={1} defaultValue={50} className={weightInput} />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-wide text-subtle">Other</span>
            <input name="otherWeight" type="number" min={0} max={100} step={1} defaultValue={20} className={weightInput} />
          </label>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add subject"}
      </button>
      {state.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground sm:col-span-4">
          {state.error}
        </p>
      )}
    </PasswordConfirmForm>
  );
}
