"use client";

import { useActionState } from "react";
import { createAccount, type ActionState } from "./actions";
import { ModuleCheckboxes } from "@/components/module-checkboxes";
import { PasswordInput } from "@/components/password-input";
import { ROLE_LABELS } from "@/lib/modules";

export function CreateAccountForm({ roleOptions }: { roleOptions: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAccount, {});

  return (
    <form action={action} className="max-w-xl space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Juan Dela Cruz"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="name@school.local"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-foreground">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={roleOptions[0]}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
            Temporary password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Modules this account can access</p>
        <ModuleCheckboxes value={[]} />
      </div>
      {state.error && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Creatingâ€¦" : "Create account"}
      </button>
    </form>
  );
}