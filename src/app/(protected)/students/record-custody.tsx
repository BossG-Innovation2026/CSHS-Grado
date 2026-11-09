"use client";

import { useActionState } from "react";
import { receiveRecord, surrenderRecord, type StudentActionState } from "./actions";
import type { SurrenderRow } from "@/server/students";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function RecordCustody({
  studentId,
  canSurrender,
  canReceive,
  surrenders,
}: {
  studentId: string;
  canSurrender: boolean;
  canReceive: boolean;
  surrenders: SurrenderRow[];
}) {
  const [surrenderState, surrenderAction, surrendering] = useActionState<StudentActionState, FormData>(
    surrenderRecord,
    {}
  );
  const [receiveState, receiveAction, receiving] = useActionState<StudentActionState, FormData>(receiveRecord, {});

  return (
    <div className="space-y-4 p-4">
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {surrenders.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>
              <span className="font-medium capitalize text-foreground">{s.reason}</span>{" "}
              <span className="text-xs text-muted">
                · {s.surrenderedAt.toLocaleDateString("en-PH")} · by {s.surrenderedByName ?? "—"}
                {s.note ? ` · ${s.note}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  s.status === "received"
                    ? "bg-success/15 text-success"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {s.status === "received" ? "Received by registrar" : "Waiting for registrar"}
              </span>
              {canReceive && s.status === "pending" && (
                <form action={receiveAction}>
                  <input type="hidden" name="surrenderId" value={s.id} />
                  <button
                    type="submit"
                    disabled={receiving}
                    className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
                  >
                    {receiving ? "Receiving…" : "Receive"}
                  </button>
                </form>
              )}
            </span>
          </li>
        ))}
        {surrenders.length === 0 && (
          <li className="px-3 py-4 text-subtle">The record is still with the class adviser.</li>
        )}
      </ul>

      {canSurrender && (
        <form action={surrenderAction} className="rounded-md border border-border p-3">
          <input type="hidden" name="studentId" value={studentId} />
          <p className="text-xs font-medium text-foreground">Surrender the permanent record to the registrar</p>
          <p className="mt-0.5 text-xs text-muted">
            Use this when the student graduates, transfers or stops attending school.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select name="reason" defaultValue="graduated" className={inputClass} aria-label="Reason">
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="stopped">Stopped attending</option>
            </select>
            <input name="note" placeholder="Note (optional)" className={inputClass} />
            <button
              type="submit"
              disabled={surrendering}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              {surrendering ? "Surrendering…" : "Surrender record"}
            </button>
          </div>
        </form>
      )}

      {surrenderState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{surrenderState.error}</p>}
      {surrenderState.message && <p className="text-sm text-accent-strong">{surrenderState.message}</p>}
      {receiveState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{receiveState.error}</p>}
      {receiveState.message && <p className="text-sm text-accent-strong">{receiveState.message}</p>}
    </div>
  );
}
