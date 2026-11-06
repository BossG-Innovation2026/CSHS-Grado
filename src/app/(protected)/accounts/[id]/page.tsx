import Link from "next/link";
import { requireAdmin, ROLE_LABELS } from "@/lib/access";
import { getAccount } from "@/server/accounts";
import { EditAccountForm } from "../edit-account-form";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) {
    return (
      <div>
        <p className="text-sm text-muted">Account not found.</p>
        <Link href="/accounts" className="mt-2 inline-block text-sm text-accent-strong hover:underline">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  const editingSelf = user.id === account.id;
  // requireAdmin() above: only System Admins reach this page, and they manage every account.
  const canEdit = true;

  return (
    <div className="max-w-2xl">
      <Link href="/accounts" className="text-sm text-accent-strong hover:underline">
        ← Back to accounts
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-on-accent">
          {account.name.charAt(0)}
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{account.name}</h1>
          <p className="text-sm text-muted">
            {account.email} ·{" "}
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
              {ROLE_LABELS[account.role] ?? account.role}
            </span>{" "}
            {!account.active && (
              <span className="rounded-full bg-panel px-2 py-0.5 text-xs font-medium text-muted">
                Deactivated
              </span>
            )}
          </p>
        </div>
      </div>

      {editingSelf && (
        <p className="mt-4 rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
          This is your own account. As a System Admin you always have every module; you can
          change your password here. Another System Admin can deactivate it if needed.
        </p>
      )}

      <div className="mt-6">
        <EditAccountForm account={account} canEdit={canEdit} editingSelf={editingSelf} />
      </div>
    </div>
  );
}