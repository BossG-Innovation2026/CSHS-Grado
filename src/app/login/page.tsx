"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/password-input";

function RegisteredNote() {
  const params = useSearchParams();
  if (params.get("registered") !== "1") return null;
  return (
    <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
      Account created. You can now sign in.
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@school.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Sign in failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong">
            Project Grado
          </span>
          <h1 className="mt-3 text-xl font-bold text-foreground">Project Grado</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Suspense fallback={null}>
            <RegisteredNote />
          </Suspense>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-accent-strong hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
