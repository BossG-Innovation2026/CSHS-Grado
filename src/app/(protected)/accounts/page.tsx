import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/access";
import { listAccounts } from "@/server/accounts";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireAdmin();
  const accounts = await listAccounts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Account Management</h1>
          <p className="mt-1 text-sm text-muted">
            Accounts show only the modules ticked at registration.
          </p>
        </div>
        <Link
          href="/accounts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong"
        >
          Register account
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((a) => {
              const perms = JSON.parse(a.permissions || "[]") as string[];
              return (
                <tr key={a.id} className={a.active ? "" : "bg-panel text-subtle"}>
                  <td className="px-4 py-3 font-medium text-foreground">{a.name}</td>
                  <td className="px-4 py-3 text-foreground">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                      {ROLE_LABELS[a.role] ?? a.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{perms.length} modules</td>
                  <td className="px-4 py-3">
                    {a.active ? (
                      <span className="text-xs font-medium text-accent-strong">Active</span>
                    ) : (
                      <span className="text-xs font-medium text-subtle">Deactivated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.id === user.id ? (
                      <Link href={`/accounts/${a.id}`} className="text-accent-strong hover:underline">
                        Your account
                      </Link>
                    ) : (
                      <Link href={`/accounts/${a.id}`} className="text-accent-strong hover:underline">
                        Manage
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}