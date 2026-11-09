"use client";

import { useActionState } from "react";
import { linkParentAccount, unlinkParent, type StudentActionState } from "./actions";
import type { ParentLinkRow } from "@/server/students";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function ParentAccess({
  studentId,
  parents,
  links,
}: {
  studentId: string;
  parents: { id: string; name: string; email: string }[];
  links: ParentLinkRow[];
}) {
  const [linkState, linkAction, linking] = useActionState<StudentActionState, FormData>(linkParentAccount, {});
  const [unlinkState, unlinkAction, unlinking] = useActionState<StudentActionState, FormData>(unlinkParent, {});

  return (
    <div className="space-y-4 p-4">
      <ul className="divide-y divide-border rounded-md border border-border">
        {links.map((link) => (
          <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-foreground">{link.parentName}</span>{" "}
              <span className="text-xs text-muted">
                ({link.relationship}) · {link.parentEmail}
              </span>
            </span>
            <form action={unlinkAction}>
              <input type="hidden" name="linkId" value={link.id} />
              <button
                type="submit"
                disabled={unlinking}
                className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-300"
              >
                Remove access
              </button>
            </form>
          </li>
        ))}
        {links.length === 0 && <li className="px-3 py-4 text-sm text-subtle">No parent account is linked yet.</li>}
      </ul>

      <form action={linkAction} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Parent account</span>
          <select name="parentEmail" defaultValue="" className={inputClass} required>
            <option value="" disabled>
              {parents.length === 0 ? "No parent accounts yet — create one in Account Management" : "Choose a parent account"}
            </option>
            {parents.map((p) => (
              <option key={p.id} value={p.email}>
                {p.name} · {p.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Relationship</span>
          <input name="relationship" defaultValue="Parent" className={inputClass} />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={linking || parents.length === 0}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {linking ? "Linking…" : "Give access"}
          </button>
        </div>
      </form>

      {linkState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{linkState.error}</p>}
      {linkState.message && <p className="text-sm text-accent-strong">{linkState.message}</p>}
      {unlinkState.error && <p className="text-sm text-rose-600 dark:text-rose-300">{unlinkState.error}</p>}
      {unlinkState.message && <p className="text-sm text-accent-strong">{unlinkState.message}</p>}
    </div>
  );
}
