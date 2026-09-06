"use client";

import { useActionState } from "react";
import {
  updatePermissions,
  resetPassword,
  setActive,
  type ActionState,
  type AccountRow,
} from "./actions";
import { ModuleCheckboxes } from "@/components/module-checkboxes";
import { PasswordInput } from "@/components/password-input";
import { parsePermissions, MODULES } from "@/lib/modules";

const MODULE_KEYS = MODULES.map((m) => m.key);

function Notice({ state }: { state: ActionState }) {
  if (!state.error && !state.ok) return null;
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.error ? "bg-accent-soft text-foreground" : "bg-accent text-on-accent"
      }`}
    >
      {state.error ?? "Saved."}
    </p>
  );
}

export function EditAccountForm({
  account,
  canEdit,
  editingSelf,
}: {
  account: AccountRow;
  canEdit: boolean;
  editingSelf: boolean;
}) {
  const [permState, permAction, permPending] = useActionState(
    updatePermissions.bind(null, account.id),
    {}
  );
  const [pwState, pwAction, pwPending] = useActionState(resetPassword.bind(null, account.id), {});
  const [activeState, activeAction, activePending] = useActionState(
    setActive.bind(null, account.id),
    {}
  );

  const locked = editingSelf ? ["accounts"] : [];
  const disabled = !canEdit ? MODULE_KEYS : [];

  return (
    <div className="space-y-8">
      <section className="max-w-xl">
        <h2 className="text-sm font-semibold text-foreground">Modules</h2>
        {!canEdit && (
          <p className="mt-1 text-xs text-muted">
            Only the super admin can manage this account.
          </p>
        )}
        <form action={permAction} className="mt-3 space-y-3">
          <ModuleCheckboxes value={parsePermissions(account.permissions)} locked={locked} disabled={disabled} />
          <Notice state={permState} />
          {canEdit && (
            <button
              type="submit"
              disabled={permPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              {permPending ? "Savingâ€¦" : "Save modules"}
            </button>
          )}
        </form>
      </section>

      <section className="max-w-xl">
        <h2 className="text-sm font-semibold text-foreground">Reset password</h2>
        <form action={pwAction} className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              New password
            </label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              disabled={!canEdit}
              placeholder="At least 8 characters"
            />
          </div>
          {canEdit && (
            <button
              type="submit"
              disabled={pwPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-panel-hover disabled:opacity-50"
            >
              {pwPending ? "Savingâ€¦" : "Reset password"}
            </button>
          )}
        </form>
        <div className="mt-2">
          <Notice state={pwState} />
        </div>
      </section>

      <section className="max-w-xl">
        <h2 className="text-sm font-semibold text-foreground">Account status</h2>
        <form action={activeAction} className="mt-3">
          <input type="hidden" name="active" value={account.active ? 0 : 1} />
          {canEdit && !editingSelf && account.role !== "super_admin" ? (
            <button
              type="submit"
              disabled={activePending}
              className={`rounded-md px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50 ${
                account.active ? "bg-panel-hover hover:bg-accent" : "bg-accent hover:bg-accent-strong"
              }`}
            >
              {activePending ? "Savingâ€¦" : account.active ? "Deactivate account" : "Activate account"}
            </button>
          ) : (
            <p className="text-sm text-muted">
              {account.active ? "Active" : "Deactivated"}
              {editingSelf && " â€” you cannot deactivate your own account."}
            </p>
          )}
          <div className="mt-2">
            <Notice state={activeState} />
          </div>
        </form>
      </section>
    </div>
  );
}