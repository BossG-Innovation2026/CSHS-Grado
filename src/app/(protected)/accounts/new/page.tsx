import Link from "next/link";
import { requireAdmin, rolesCreatableBy } from "@/lib/access";
import { CreateAccountForm } from "../create-account-form";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const user = await requireAdmin();
  const roleOptions = rolesCreatableBy(user);

  return (
    <div className="max-w-2xl">
      <Link href="/accounts" className="text-sm text-accent-strong hover:underline">
        ← Back to accounts
      </Link>
      <h1 className="mt-2 text-xl font-bold text-foreground">Register account</h1>
      <p className="mt-1 text-sm text-muted">
        Tick the modules this account can access. Admin accounts always keep Account Management.
      </p>
      <div className="mt-6">
        <CreateAccountForm roleOptions={roleOptions} />
      </div>
    </div>
  );
}