"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { CheckCircle2, LockKeyhole, Save, Send, Users } from "lucide-react";
import { saveGrades, type GradeActionState } from "@/app/(protected)/grades/actions";
import {
  computeFinalGrade,
  GRADING,
  remarkFor,
  type GradeComponents,
  type GradeWeights,
} from "@/lib/grades";
import type { SubjectOffering } from "@/server/grades";

export interface GradeEntryStudent {
  id: string;
  lrn: string;
  surname: string;
  firstname: string;
  middlename: string;
  gradeValue: number | null;
  writtenWork: number | null;
  performanceTask: number | null;
  otherAssessment: number | null;
}

interface Entry {
  ww: string;
  pt: string;
  other: string;
  grade: string;
}

function text(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseComponent(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= GRADING.componentMin && value <= GRADING.componentMax
    ? value
    : null;
}

function isInvalidComponent(raw: string): boolean {
  return raw.trim() !== "" && parseComponent(raw) === null;
}

function weightsOf(offering: SubjectOffering): GradeWeights {
  return {
    writtenWork: offering.wwWeight,
    performanceTask: offering.ptWeight,
    otherAssessment: offering.otherWeight,
  };
}

const inputClass =
  "w-full rounded-lg border border-border bg-input px-2 py-1.5 text-center text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted";

function scoreTone(value: number | null) {
  if (value === null) return "text-subtle";
  return value >= GRADING.passing ? "text-success" : "text-danger";
}

export function GradeEntryTable({
  offering,
  students,
  canEncode,
  dense = false,
}: {
  offering: SubjectOffering;
  students: GradeEntryStudent[];
  canEncode: boolean;
  dense?: boolean;
}) {
  const [state, action, pending] = useActionState<GradeActionState, FormData>(saveGrades, {});
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      students.map((s) => [
        s.id,
        {
          ww: text(s.writtenWork),
          pt: text(s.performanceTask),
          other: text(s.otherAssessment),
          grade: text(s.gradeValue),
        },
      ])
    )
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const weights = useMemo(() => weightsOf(offering), [offering]);

  function computedFor(entry: Entry): number | null {
    const components: Pick<GradeComponents, "writtenWork" | "performanceTask" | "otherAssessment"> = {
      writtenWork: parseComponent(entry.ww),
      performanceTask: parseComponent(entry.pt),
      otherAssessment: parseComponent(entry.other),
    };
    return computeFinalGrade(components, weights);
  }

  function update(id: string, key: keyof Entry, value: string) {
    setEntries((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  }

  function confirmSubmit() {
    setConfirmOpen(false);
    formRef.current?.requestSubmit(submitButtonRef.current);
  }

  const missingCount = students.filter((s) => {
    const entry = entries[s.id];
    if (!entry) return true;
    const computed = computedFor(entry);
    return computed === null && !entry.grade.trim();
  }).length;

  return (
    <form ref={formRef} action={action} className="relative">
      <input type="hidden" name="classSubjectId" value={offering.id} />

      {offering.status === "returned" && offering.returnNote && (
        <div className="mx-3 mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          <span className="font-semibold">Returned for correction: </span>
          {offering.returnNote}
        </div>
      )}

      <div className="max-h-[26rem] overflow-auto">
        <table className={`w-full min-w-[720px] text-left ${dense ? "text-xs" : "text-sm"}`}>
          <thead className="sticky top-0 z-10 border-b border-border bg-panel text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Student</th>
              <th className="w-20 px-2 py-2.5 text-center font-semibold">Written</th>
              <th className="w-20 px-2 py-2.5 text-center font-semibold">Performance</th>
              <th className="w-20 px-2 py-2.5 text-center font-semibold">Other</th>
              <th className="w-24 px-2 py-2.5 text-center font-semibold">Final grade</th>
              <th className="w-24 px-2 py-2.5 font-semibold">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {students.map((s) => {
              const entry = entries[s.id] ?? { ww: "", pt: "", other: "", grade: "" };
              const computed = computedFor(entry);
              const finalRaw = computed !== null ? String(computed) : entry.grade;
              const finalNumber = finalRaw.trim() === "" ? null : Number(finalRaw);
              const finalValid =
                finalNumber !== null &&
                Number.isInteger(finalNumber) &&
                finalNumber >= GRADING.min &&
                finalNumber <= GRADING.max;
              const invalidComponent =
                isInvalidComponent(entry.ww) || isInvalidComponent(entry.pt) || isInvalidComponent(entry.other);

              return (
                <tr key={s.id} className="transition-colors hover:bg-panel/40">
                  <td className="px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {s.surname}, {s.firstname}
                    </p>
                    <p className="text-[10px] text-subtle">LRN {s.lrn}</p>
                  </td>
                  {(["ww", "pt", "other"] as const).map((key) => (
                    <td key={key} className="px-2 py-2.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={GRADING.componentMin}
                        max={GRADING.componentMax}
                        step={1}
                        name={`${key}_${s.id}`}
                        value={entry[key]}
                        onChange={(event) => update(s.id, key, event.target.value)}
                        disabled={!canEncode || pending}
                        placeholder="—"
                        aria-label={`${key === "ww" ? "Written Works" : key === "pt" ? "Performance Tasks" : "Other components"} for ${s.firstname} ${s.surname}`}
                        aria-invalid={isInvalidComponent(entry[key])}
                        className={`${inputClass} ${isInvalidComponent(entry[key]) ? "border-danger" : ""}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={GRADING.min}
                      max={GRADING.max}
                      step={1}
                      name={`grade_${s.id}`}
                      value={finalRaw}
                      onChange={(event) => update(s.id, "grade", event.target.value)}
                      readOnly={computed !== null}
                      disabled={!canEncode || pending}
                      placeholder="—"
                      aria-label={`Final grade for ${s.firstname} ${s.surname}`}
                      title={computed !== null ? "Computed from the three assessment components" : undefined}
                      className={`${inputClass} ${computed !== null ? "bg-panel/60 text-accent-strong" : ""} ${
                        finalRaw.trim() !== "" && !finalValid ? "border-danger" : ""
                      }`}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`text-[11px] font-medium ${
                        invalidComponent
                          ? "text-danger"
                          : finalRaw.trim() === ""
                            ? "text-subtle"
                            : finalValid
                              ? scoreTone(finalNumber)
                              : "text-danger"
                      }`}
                    >
                      {invalidComponent
                        ? "0–100 only"
                        : finalRaw.trim() === ""
                          ? "Not encoded"
                          : finalValid
                            ? remarkFor(finalNumber)
                            : "60–100 only"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Users size={24} className="mx-auto text-subtle" />
          <p className="mt-2 text-xs font-medium text-foreground">No students enrolled</p>
          <p className="mt-1 text-[11px] text-muted">Students added to this class will appear here.</p>
        </div>
      )}

      <div className="border-t border-border p-3">
        {state.error && (
          <p className="mb-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
            {state.error}
          </p>
        )}
        {state.message && (
          <p className="mb-2 flex items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 size={13} /> {state.message}
          </p>
        )}

        {canEncode ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted">
              Weights: Written {offering.wwWeight}% · Performance {offering.ptWeight}% · Other{" "}
              {offering.otherWeight}%. A final grade of {GRADING.passing} or higher is passing.
            </p>
            <div className="flex gap-1.5">
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-panel-hover disabled:opacity-50"
              >
                <Save size={13} /> {pending ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                <Send size={13} /> Submit
              </button>
              <button ref={submitButtonRef} type="submit" name="intent" value="submit" className="hidden" aria-hidden />
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <LockKeyhole size={13} /> This sheet is locked while it is with the verifier or registrar.
          </p>
        )}
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm grade submission"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Submit these grades?</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {offering.className} · {offering.code} · Term {offering.term}. The sheet goes to the
              class adviser for verification and can no longer be edited until it is returned.
            </p>
            {missingCount > 0 && (
              <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                {missingCount} student{missingCount === 1 ? " still has" : "s still have"} no final
                grade. The server will reject the submission until every student is encoded.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-strong"
              >
                Submit for verification
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
