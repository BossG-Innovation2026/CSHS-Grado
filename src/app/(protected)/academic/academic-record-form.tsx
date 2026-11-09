"use client";

import { useActionState } from "react";
import { addAcademicRecord, deleteAcademicRecord, type StudentActionState } from "../students/actions";
import type { AcademicRecordRow } from "@/server/students";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function AcademicRecordForm({ studentId, records }: { studentId: string; records: AcademicRecordRow[] }) {
  const [addState, addAction, adding] = useActionState<StudentActionState, FormData>(addAcademicRecord, {});
  const [deleteState, deleteAction, deleting] = useActionState<StudentActionState, FormData>(deleteAcademicRecord, {});

  return (
    <div className="space-y-4 p-4">
      <form action={addAction} className="space-y-3 rounded-md border border-border p-3">
        <input type="hidden" name="studentId" value={studentId} />
        <p className="text-xs font-medium text-foreground">Add a previous-school record</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="schoolName" required placeholder="School name" className={inputClass} />
          <input name="schoolYear" placeholder="School year (e.g. 2024-2025)" className={inputClass} />
          <input name="gradeLevel" placeholder="Grade level (e.g. Grade 10)" className={inputClass} />
          <input name="generalAverage" placeholder="General average" className={inputClass} />
          <input name="honors" placeholder="Honors (optional)" className={inputClass} />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="completed" value="1" className="h-4 w-4" />
            Completed
          </label>
        </div>
        <textarea
          name="subjects"
          rows={4}
          placeholder={"Subjects, one per line:\nMathematics | 88\nEnglish | 90"}
          className={inputClass}
        />
        <input name="note" placeholder="Note (optional)" className={inputClass} />
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            {addState.error && <p className="text-rose-600 dark:text-rose-300">{addState.error}</p>}
            {addState.message && <p className="text-accent-strong">{addState.message}</p>}
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add record"}
          </button>
        </div>
      </form>

      {records.length > 0 && (
        <div className="rounded-md border border-border">
          {records.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {r.schoolName} · {r.gradeLevel || "—"}
                </p>
                <p className="text-xs text-muted">
                  SY {r.schoolYear || "—"} · {r.subjects.length} subject(s)
                  {r.generalAverage ? ` · Average ${r.generalAverage}` : ""}
                  {r.completed ? " · Completed" : ""}
                </p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="recordId" value={r.id} />
                <button
                  type="submit"
                  disabled={deleting}
                  className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-300"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {deleteState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{deleteState.error}</p>}
      {deleteState.message && <p className="text-sm text-accent-strong">{deleteState.message}</p>}
    </div>
  );
}
