"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/password-input";

export interface DemoLogin {
  role: string;
  roleLabel: string;
  email: string;
  password: string;
  summary: string;
}

function RegisteredNote() {
  const params = useSearchParams();
  if (params.get("registered") !== "1") return null;
  return (
    <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">
      Account created. You can now sign in.
    </p>
  );
}

export function LoginForm({ demoLogins }: { demoLogins: DemoLogin[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(withEmail: string, withPassword: string, key: string) {
    setError(null);
    setLoading(key);
    const { error: authError } = await authClient.signIn.email({ email: withEmail, password: withPassword });
    if (authError) {
      setLoading(null);
      setError(authError.message ?? "Sign in failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void signIn(email, password, "form");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-xl">
          <div className="text-center">
            <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong">
              {demoLogins.length > 0 ? "Demo — fake data" : "Project Grado"}
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
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{error}</p>}
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
            >
              {loading === "form" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            No account yet?{" "}
            <Link href="/register" className="font-medium text-accent-strong hover:underline">
              Register
            </Link>
          </p>
        </div>

        {demoLogins.length > 0 && (
          <section aria-labelledby="demo-heading" className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 id="demo-heading" className="text-sm font-semibold text-foreground">
              Try a demo account
            </h2>
            <p className="mt-1 text-xs text-muted">
              Everything on this demo site is fake. Password for all: <code>{demoLogins[0].password}</code>
            </p>
            <ul className="mt-3 space-y-2">
              {demoLogins.map((d) => (
                <li key={d.role}>
                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void signIn(d.email, d.password, d.role)}
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-panel-hover disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {loading === d.role ? "Signing in…" : `Sign in as ${d.roleLabel}`}
                      </span>
                      <span className="block text-xs text-muted">
                        {d.email} · {d.summary}
                      </span>
                    </span>
                    <span aria-hidden className="text-accent-strong">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
