import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * /register exists only to create the first System Admin. Once one exists,
 * accounts are created from Account Management.
 * Public by design: it reveals only whether the system has been set up.
 */
export async function findSystemAdminExists(): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "system_admin"))
    .limit(1);
  return Boolean(row);
}
