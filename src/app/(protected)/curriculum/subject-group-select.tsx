"use client";

import { useActionState } from "react";
import { setSubjectGradingGroup, type ActionState } from "./actions";

export function SubjectGroupSelect({
  id,
  gradeLevelId,
  value,
  options,
}: {
  id: string;
  gradeLevelId: string;
  value: string | null;
  options: { key: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setSubjectGradingGroup, {});

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="gradeLevelId" value={gradeLevelId} />
      <select
        key={value ?? ""}
        name="gradingGroup"
        aria-label="Grading group"
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full max-w-64 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
      >
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {state.error && <p className="mt-1 text-xs text-foreground">{state.error}</p>}
    </form>
  );
}
