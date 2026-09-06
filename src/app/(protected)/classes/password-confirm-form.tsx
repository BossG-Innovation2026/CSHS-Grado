"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { PasswordInput } from "@/components/password-input";

export function PasswordConfirmForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const confirmingRef = useRef(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (confirmingRef.current) return;
    e.preventDefault();
    setPassword("");
    setOpen(true);
  }

  function confirm() {
    const form = formRef.current;
    if (!form || !password) return;
    confirmingRef.current = true;
    setOpen(false);
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "password";
    input.value = password;
    form.appendChild(input);
    form.requestSubmit();
    window.setTimeout(() => {
      input.remove();
      confirmingRef.current = false;
    }, 0);
  }

  return (
    <>
      <form ref={formRef} action={action} onSubmit={onSubmit} className={className}>
        {children}
      </form>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm your password"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-foreground">Confirm your password</h3>
            <p className="mt-1 text-xs text-muted">
              Enter your password to make this change.
            </p>
            <PasswordInput
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              placeholder="Your password"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-panel-hover hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!password}
                onClick={confirm}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}