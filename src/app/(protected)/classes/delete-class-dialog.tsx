"use client";

import { useActionState, useState } from "react";
import { deleteClass, type ActionState } from "./actions";
import { PasswordInput } from "@/components/password-input";

export function DeleteClassDialog({ classId, className }: { classId: string; className: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteClass, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground"
      >
        Delete class
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete class confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <form action={action} className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
            <input type="hidden" name="id" value={classId} />
            <h3 className="text-sm font-semibold text-foreground">Delete class</h3>
            <p className="mt-1 text-xs text-muted">
              This permanently deletes <span className="font-medium text-foreground">{className}</span>{" "}
              and its subject setups. This cannot be undone.
            </p>
            <label className="mt-3 block">
              <span className="text-xs text-muted">Confirm your password</span>
              <PasswordInput
                name="password"
                required
                autoFocus
                placeholder="Your password"
              />
            </label>
            {state.error && (
              <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
                {state.error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete class"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}