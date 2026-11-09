import "server-only";
import { randomUUID } from "node:crypto";
import { schema, type Db } from "@/db";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/** Append-only trail required by DepEd Order 015 para. 61. */
export async function writeAudit(
  db: DbOrTx,
  entry: { actorId: string; action: string; entity: string; entityId: string; detail?: unknown }
): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    detail: entry.detail ?? null,
  });
}
