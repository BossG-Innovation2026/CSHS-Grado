import "server-only";
import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/access";
import type { SessionUser } from "@/lib/session";

const { auditLog } = schema;

export interface AuditRow {
  id: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  createdAt: Date;
}

/**
 * Append one entry to the audit trail. Call this after the change it records
 * has been written, so the log never claims something that did not happen.
 */
export async function recordAudit(
  actor: Pick<SessionUser, "id" | "name">,
  action: string,
  entity: string,
  entityId: string,
  detail = ""
): Promise<void> {
  await getDb().insert(auditLog).values({
    id: randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entity,
    entityId,
    detail: detail.slice(0, 500),
  });
}

/** Newest audit entries first. Registrar and admins only. */
export async function listAudit(limit = 200): Promise<AuditRow[]> {
  await requireModule("audit");
  return getDb()
    .select({
      id: auditLog.id,
      actorName: auditLog.actorName,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      detail: auditLog.detail,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
