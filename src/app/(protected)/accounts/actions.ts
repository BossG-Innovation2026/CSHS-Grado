"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/db";
import { MODULES, ROLE_SYSTEM_ADMIN, rolesCreatableBy, type ModuleKey } from "@/lib/modules";
import { adminUser } from "@/server/guards";
import { findAccount } from "@/server/accounts";

export type { AccountRow } from "@/server/accounts";

const { user, account, session } = schema;

export interface ActionState {
  error?: string;
  ok?: boolean;
}

function parseModules(formData: FormData): ModuleKey[] {
  const picked = formData.getAll("modules").map(String);
  return MODULES.filter((m) => picked.includes(m.key)).map((m) => m.key);
}

function revalidateAccount(id?: string) {
  revalidatePath("/accounts");
  if (id) revalidatePath(`/accounts/${id}`);
}

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized to create accounts." };

  const role = String(formData.get("role") ?? "");
  if (!rolesCreatableBy(actor).includes(role)) {
    return { error: "You cannot create accounts with this role." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  // System Admins always have every module; for other roles the ticked boxes apply.
  const modules = role === ROLE_SYSTEM_ADMIN ? MODULES.map((m) => m.key) : parseModules(formData);

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const created = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(user)
      .values({ id, name, email, emailVerified: true, role, permissions: JSON.stringify(modules), active: true })
      .onConflictDoNothing({ target: user.email })
      .returning({ id: user.id });
    if (inserted.length === 0) return false;
    await tx
      .insert(account)
      .values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    return true;
  });
  if (!created) return { error: "An account with this email already exists." };

  revalidateAccount();
  redirect("/accounts");
}

export async function updatePermissions(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized." };
  const target = await findAccount(id);
  if (!target) return { error: "Account not found." };

  if (target.role === ROLE_SYSTEM_ADMIN) {
    return { error: "System Admins always have every module." };
  }

  const modules = parseModules(formData);

  await getDb().update(user).set({ permissions: JSON.stringify(modules) }).where(eq(user.id, id));
  revalidateAccount(id);
  return { ok: true };
}

export async function resetPassword(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized." };
  const target = await findAccount(id);
  if (!target) return { error: "Account not found." };

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await hashPassword(password);
  await getDb().transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(account.providerId, "credential"), eq(account.userId, id)));
    // A reset often follows a compromise: sign the account out everywhere.
    await tx.delete(session).where(eq(session.userId, id));
  });
  return { ok: true };
}

export async function setActive(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await adminUser();
  if (!actor) return { error: "You are not authorized." };
  const target = await findAccount(id);
  if (!target) return { error: "Account not found." };

  // You cannot lock yourself out, so at least one System Admin always stays active.
  if (actor.id === id) return { error: "You cannot deactivate your own account." };

  const active = formData.get("active") === "1";
  await getDb().update(user).set({ active, updatedAt: new Date() }).where(eq(user.id, id));
  revalidateAccount(id);
  return { ok: true };
}
