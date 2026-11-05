"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";

const { user } = schema;

export type RegisterState = { error?: string } | null;

export async function registerAccount(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter your full name and a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  try {
    await getAuth().api.signUpEmail({ body: { name, email, password } });
  } catch {
    return { error: "Could not create the account. That email may already be registered." };
  }

  // New accounts start as teachers with no modules. The very first account
  // becomes Super Admin; the NOT EXISTS check makes this a single atomic step,
  // so two people registering at once cannot both become Super Admin.
  await getDb()
    .update(user)
    .set({ role: "super_admin" })
    .where(
      sql`${eq(user.email, email)} AND NOT EXISTS (SELECT 1 FROM ${user} AS u WHERE u.role = 'super_admin')`
    );

  redirect("/login?registered=1");
}
