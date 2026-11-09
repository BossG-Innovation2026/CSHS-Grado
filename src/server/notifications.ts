import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/db";

const { notification } = schema;

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
}

/** Newest notifications for the signed-in account. */
export async function listNotifications(userId: string, limit = 8): Promise<NotificationRow[]> {
  return getDb()
    .select({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    })
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return row?.count ?? 0;
}

/**
 * Create in-app notifications. Internal helper: callers have already
 * authorized the action that caused the notification. Duplicate recipients
 * are collapsed and the actor may be excluded by the caller.
 */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  input: { title: string; body?: string; type?: "info" | "success" | "warning" | "danger" }
): Promise<void> {
  const recipients = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (recipients.length === 0) return;
  await getDb()
    .insert(notification)
    .values(
      recipients.map((userId) => ({
        id: randomUUID(),
        userId,
        title: input.title.slice(0, 160),
        body: (input.body ?? "").slice(0, 500),
        type: input.type ?? "info",
      }))
    );
}

/** Everyone who can approve/verify grades, for workflow notifications. */
export async function usersWithRole(role: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(eq(schema.user.role, role), eq(schema.user.active, true)));
  return rows.map((r) => r.id);
}

/** Ids of active accounts holding one of the given roles. */
export async function usersWithRoles(roles: string[]): Promise<string[]> {
  if (roles.length === 0) return [];
  const rows = await getDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(inArray(schema.user.role, roles), eq(schema.user.active, true)));
  return rows.map((r) => r.id);
}
