"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/session";

const { notification } = schema;

export interface NotificationActionState {
  error?: string;
  ok?: boolean;
}

/** Mark one notification read. Only the owner can change it. */
export async function markNotificationRead(
  _prev: NotificationActionState,
  formData: FormData
): Promise<NotificationActionState> {
  void _prev;
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Notification not found." };

  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.userId, user.id)));

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mark every notification of the signed-in account as read. */
export async function markAllNotificationsRead(
  _prev: NotificationActionState,
  _formData: FormData
): Promise<NotificationActionState> {
  void _prev;
  void _formData;
  const user = await getSessionUser();
  if (!user) return { error: "You are not signed in." };

  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));

  revalidatePath("/", "layout");
  return { ok: true };
}
