import Link from "next/link";
import { findSystemAdminExists } from "@/server/bootstrap";
import { RegisterForm } from "./register-form";

// Depends on the database: open only until the first System Admin exists.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (!(await findSystemAdminExists())) return <RegisterForm />;

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-xl">
        <h1 className="text-xl font-bold text-foreground">Registration is closed</h1>
        <p className="mt-2 text-sm text-muted">Ask your System Admin to create an account for you.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-accent-strong hover:underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
