"use client";

import { useActionState, useState } from "react";
import { createClass, type ActionState } from "./actions";

export interface CreateClassData {
  gradeLevels: { id: string; name: string }[];
  classCounts: Record<string, number>;
}

function nextSectionName(gradeName: string, count: number): string {
  return `${gradeName} - ${String.fromCharCode(65 + count)}`;
}

export function CreateClassForm({ data }: { data: CreateClassData }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createClass, {});

  const [gradeLevelId, setGradeLevelId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);

  function onGradeChange(next: string) {
    setGradeLevelId(next);
    if (!nameEdited) {
      setSectionName(nextSectionName(
        data.gradeLevels.find((g) => g.id === next)?.name ?? "",
        data.classCounts[next] ?? 0
      ));
    }
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gradeLevelId" className="mb-1 block text-sm font-medium text-foreground">
            Grade level
          </label>
          <select
            id="gradeLevelId"
            name="gradeLevelId"
            required
            value={gradeLevelId}
            onChange={(e) => onGradeChange(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="" disabled>
              Select…
            </option>
            {data.gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
            Section name
          </label>
          <input
            id="name"
            name="name"
            value={sectionName}
            onChange={(e) => {
              setSectionName(e.target.value);
              setNameEdited(true);
            }}
            placeholder="e.g. Grade 11 - A"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="strand" className="mb-1 block text-sm font-medium text-foreground">
            Strand / track
          </label>
          <input
            id="strand"
            name="strand"
            placeholder="e.g. ICT, HUMSS, STEM"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="schoolYear" className="mb-1 block text-sm font-medium text-foreground">
            School year
          </label>
          <input
            id="schoolYear"
            name="schoolYear"
            placeholder="e.g. 2026-2027"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {state.needsConfirm && (
        <label className="flex items-start gap-2 rounded-md border border-border bg-accent-soft p-3 text-sm text-foreground">
          <input type="checkbox" name="confirm" value="1" className="mt-0.5" />
          <span>
            {state.error} I still want to create this class.
          </span>
        </label>
      )}
      {state.error && !state.needsConfirm && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create class"}
      </button>
    </form>
  );
}