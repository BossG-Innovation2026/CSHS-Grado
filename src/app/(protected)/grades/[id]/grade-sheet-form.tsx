"use client";

import { useActionState } from "react";
import { saveGrades, type GradeActionState } from "../actions";
import type { SheetStudent } from "@/server/grades";

export function GradeSheetForm({
  classSubjectId,
  students,
  canEncode,
}: {
  classSubjectId: string;
  students: SheetStudent[];
  canEncode: boolean;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(saveGrades, {});

  return (
    <form action={action}>
      <input type="hidden" name="classSubjectId" value={classSubjectId} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">LRN</th>
              <th className="px-4 py-3">Student</th>
              <th className="w-32 px-4 py-3">Grade (60–100)</th>
              <th className="px-4 py-3">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-accent-strong">{s.lrn}</td>
                <td className="px-4 py-3 text-foreground">
                  {s.surname}, {s.firstname}
                  {s.middlename ? ` ${s.middlename}` : ""}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={60}
                    max={100}
                    step={1}
                    name={`grade_${s.id}`}
                    defaultValue={s.gradeValue ?? ""}
                    disabled={!canEncode}
                    placeholder="—"
                    aria-label={`Grade for ${s.firstname} ${s.surname}`}
                    className="w-24 rounded-md border border-border px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:bg-panel disabled:text-muted"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {s.gradeValue === null ? "Not encoded" : s.gradeValue >= 75 ? "Passed" : "Failed"}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-subtle">
                  No students are enrolled in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <div className="text-sm">
          {state.error && <p className="text-rose-600 dark:text-rose-300">{state.error}</p>}
          {state.message && <p className="text-accent-strong">{state.message}</p>}
          {!canEncode && !state.error && (
            <p className="text-xs text-muted">This sheet is locked while it is with the verifier or registrar.</p>
          )}
        </div>
        {canEncode && (
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={pending}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-panel-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="submit"
              name="intent"
              value="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              Submit for verification
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
