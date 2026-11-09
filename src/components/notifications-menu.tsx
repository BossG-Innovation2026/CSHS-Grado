"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationActionState,
} from "@/app/(protected)/notifications/actions";
import type { NotificationRow } from "@/server/notifications";

const TONES: Record<string, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-accent-soft text-accent-strong",
};

/** UTC timestamp, identical on the server and in the browser (no hydration drift). */
function stamp(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function NotificationsMenu({
  notifications,
  unread,
}: {
  notifications: NotificationRow[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [readState, readAction, marking] = useActionState<NotificationActionState, FormData>(
    markNotificationRead,
    {}
  );
  const [allState, allAction, markingAll] = useActionState<NotificationActionState, FormData>(
    markAllNotificationsRead,
    {}
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-panel text-muted transition-colors hover:border-accent/50 hover:bg-panel-hover hover:text-foreground"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-on-accent">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/40"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-panel/60 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-foreground">Notifications</p>
              <p className="text-[11px] text-muted">
                {unread > 0 ? `${unread} unread` : "You are all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <form action={allAction}>
                <button
                  type="submit"
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:bg-panel-hover hover:text-foreground disabled:opacity-50"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              </form>
            )}
          </div>

          <ul className="max-h-80 divide-y divide-border/80 overflow-y-auto">
            {notifications.map((item) => (
              <li key={item.id} className={item.readAt ? "bg-transparent" : "bg-accent-soft/25"}>
                <form action={readAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    disabled={marking || Boolean(item.readAt)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-panel-hover/60 disabled:cursor-default"
                  >
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          item.readAt ? "bg-border" : "bg-accent"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {item.title}
                        </span>
                        {item.body && (
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted">
                            {item.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] text-subtle">{stamp(item.createdAt)}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          TONES[item.type] ?? TONES.info
                        }`}
                      >
                        {item.type}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="px-4 py-8 text-center">
                <BellOff size={22} className="mx-auto text-subtle" />
                <p className="mt-2 text-xs font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-[11px] text-muted">
                  Grade submissions, verification and approvals appear here.
                </p>
              </li>
            )}
          </ul>

          {(readState.error || allState.error) && (
            <p className="border-t border-border bg-danger/10 px-4 py-2 text-[11px] text-danger">
              {readState.error ?? allState.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
