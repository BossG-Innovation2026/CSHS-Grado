import "server-only";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { getDb, schema } from "@/db";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { can, isAdmin, type ModuleKey } from "@/lib/modules";

/**
 * Guards for Server Actions. Actions are public POST endpoints, so every
 * action re-checks who is calling, even if the page that renders the form
 * already did.
 */

export async function userWithModule(module: ModuleKey): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !can(user, module)) return null;
  return user;
}

export async function adminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return null;
  return user;
}

/** Re-confirm the caller's own password before a sensitive change. */
export async function checkOwnPassword(user: SessionUser, password: string): Promise<string | null> {
  if (!password) return "Enter your password to continue.";
  const [row] = await getDb()
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")))
    .limit(1);
  if (!row?.password) return "Account not found.";
  const ok = await verifyPassword({ hash: row.password, password });
  return ok ? null : "Incorrect password.";
}
