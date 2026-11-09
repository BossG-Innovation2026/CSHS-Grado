"use client";

import { useEffect, useState, useTransition, type KeyboardEvent } from "react";
import { GRADE_MAX, GRADE_MIN, parseFinalGrade } from "@/lib/grades";
import type { GradeSheet, SheetStudent } from "@/server/grades";
import { saveFinalGrades, type ActionState } from "./actions";

function moveFocus(event: KeyboardEvent<HTMLInputElement>, row: number) {
  const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" || event.key === "Enter" ? 1 : 0;
  if (step === 0) return;
  const next = document.querySelector<HTMLInputElement>(`input[data-row="${row + step}"]`);
  if (next) {
    event.preventDefault();
    next.focus();
    next.select();
  }
}

export function FinalGradeGrid({ sheet }: { sheet: GradeSheet }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ActionState>({});
  const [saving, startSaving] = useTransition();

  const saved = (learner: SheetStudent) => String(sheet.grades[learner.id] ?? "");
  const shown = (learner: SheetStudent) => edits[learner.id] ?? saved(learner);

  const changed = sheet.students.flatMap((learner) => {
    const value = edits[learner.id];
    return value !== undefined && value.trim() !== saved(learner) ? [{ studentId: learner.id, value }] : [];
  });
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save() {
    startSaving(async () => {
      const outcome = await saveFinalGrades(sheet.id, changed);
      setResult(outcome);
      if (outcome.ok) setEdits({});
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Final grades</h2>
          <p className="mt-0.5 text-xs text-muted">
            {sheet.canEdit ? `Enter each learner's final grade, a whole number from ${GRADE_MIN} to ${GRADE_MAX}.` : "Read only."}
          </p>
        </div>
        {sheet.canEdit && (
          <div className="flex items-center gap-3">
            <a href={`/grades/${sheet.id}/template.xlsx`} className="text-sm text-accent-strong hover:underline">
              Download Excel
            </a>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              {saving ? "Saving…" : dirty ? `Save ${changed.length} change(s)` : "Saved"}
            </button>
          </div>
        )}
      </div>

      {(result.error || result.message) && (
        <div className="border-b border-border bg-accent-soft px-4 py-2 text-sm text-foreground">
          <p>{result.error ?? result.message}</p>
          {result.problems && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-2">
              Learner
            </th>
            <th scope="col" className="px-4 py-2">
              LRN
            </th>
            <th scope="col" className="w-32 px-4 py-2 text-center">
              Final grade
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sheet.students.map((learner, row) => {
            const value = shown(learner);
            const check = parseFinalGrade(value);
            const invalid = check.kind === "invalid";
            return (
              <tr key={learner.id}>
                <th scope="row" className="px-4 py-1.5 font-normal text-foreground">
                  {learner.surname}, {learner.firstname}
                </th>
                <td className="px-4 py-1.5 text-xs text-muted">{learner.lrn}</td>
                <td className="px-4 py-1.5 text-center">
                  <input
                    value={value}
                    disabled={!sheet.canEdit}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={3}
                    data-grade={learner.id}
                    data-row={row}
                    aria-label={`Final grade for ${learner.surname}, ${learner.firstname}`}
                    aria-invalid={invalid}
                    title={invalid ? check.reason : undefined}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [learner.id]: e.target.value }))}
                    onKeyDown={(e) => moveFocus(e, row)}
                    className={`w-16 rounded-md border bg-surface px-1 py-1 text-center text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-70 ${
                      invalid ? "border-2 border-accent-strong" : "border-border"
                    }`}
                  />
                </td>
              </tr>
            );
          })}
          {sheet.students.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-subtle">
                No learners are enrolled in this class yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
