"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/db";
import { MODULES, ROLE_SYSTEM_ADMIN } from "@/lib/modules";
import { findSystemAdminExists } from "@/server/bootstrap";

const { user, account } = schema;

export type RegisterState = { error?: string } | null;

const CLOSED: RegisterState = { error: "Registration is closed. Ask your System Admin for an account." };

/** Serializes first-account creation; any fixed number works. */
const BOOTSTRAP_LOCK = 720_011;

export async function registerAccount(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  // Checked first so closed registration never spends CPU on password hashing.
  if (await findSystemAdminExists()) return CLOSED;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter your full name and a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const outcome = await getDb().transaction(async (tx) => {
    // Without the lock, two simultaneous registrations could both see no System Admin.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`);
    const [admin] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, ROLE_SYSTEM_ADMIN))
      .limit(1);
    if (admin) return "closed" as const;

    const inserted = await tx
      .insert(user)
      .values({
        id,
        name,
        email,
        emailVerified: true,
        role: ROLE_SYSTEM_ADMIN,
        permissions: JSON.stringify(MODULES.map((m) => m.key)),
        active: true,
      })
      .onConflictDoNothing({ target: user.email })
      .returning({ id: user.id });
    if (inserted.length === 0) return "duplicate" as const;

    await tx
      .insert(account)
      .values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    return "created" as const;
  });

  if (outcome === "closed") return CLOSED;
  if (outcome === "duplicate") return { error: "An account with this email already exists." };
  redirect("/login?registered=1");
}
