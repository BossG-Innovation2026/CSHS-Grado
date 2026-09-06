"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAccount, type RegisterState } from "./actions";
import { PasswordInput } from "@/components/password-input";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAccount, null);

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong">
            Project Grado
          </span>
          <h1 className="mt-3 text-xl font-bold text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted">The first account on this system becomes the Super Admin.</p>
        </div>
        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
              Full name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="Juan Dela Cruz"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
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
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          {state?.error && (
            <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-foreground">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "Creating…" : "Register"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-strong hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}