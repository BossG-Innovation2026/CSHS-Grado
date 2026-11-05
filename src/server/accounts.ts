import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/access";

const { user } = schema;

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string;
  active: boolean;
}

const accountColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: user.permissions,
  active: user.active,
};

/* Reads: admin only. */

export async function listAccounts(): Promise<AccountRow[]> {
  await requireAdmin();
  return getDb()
    .select(accountColumns)
    .from(user)
    .orderBy(desc(user.active), sql`lower(${user.name})`);
}

export async function getAccount(id: string): Promise<AccountRow | undefined> {
  await requireAdmin();
  return findAccount(id);
}

/* Internal helper (no access check: callers check first). */

export async function findAccount(id: string): Promise<AccountRow | undefined> {
  const [row] = await getDb().select(accountColumns).from(user).where(eq(user.id, id)).limit(1);
  return row;
}
