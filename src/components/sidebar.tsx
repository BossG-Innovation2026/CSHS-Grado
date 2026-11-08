"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  CalendarDays,
  PenLine,
  ClipboardCheck,
  Landmark,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const MODULE_ICONS: Record<string, LucideIcon> = {
  accounts: Users,
  curriculum: BookOpen,
  classes: GraduationCap,
  grades_submit: PenLine,
  grades_approve: ClipboardCheck,
  registrar: Landmark,
  codes: KeyRound,
  "/settings/school-year": CalendarDays,
};

const STORAGE_KEY = "sidebar-collapsed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

function persistCollapsed(next: boolean) {
  localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  listeners.forEach((l) => l());
}

export function Sidebar({
  userName,
  userEmail,
  roleLabel,
  links,
}: {
  userName: string;
  userEmail: string;
  roleLabel: string;
  links: { href: string; label: string; module?: string; implemented: boolean }[];
}) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    persistCollapsed(!collapsed);
  }

  const navItem =
    "mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-panel-hover";

  return (
    <aside
      className={`relative flex flex-col bg-panel text-foreground transition-all ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <button
        onClick={toggle}
        title={collapsed ? "Expand panel" : "Collapse panel"}
        className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-panel-hover text-muted shadow hover:text-foreground"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <div className="flex items-center justify-center border-b border-border px-4 py-3">
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Project Grado</p>
            <p className="truncate text-xs text-accent">{roleLabel}</p>
          </div>
        ) : (
          <GraduationCap size={20} className="shrink-0 text-accent" />
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <Link
          href="/dashboard"
          title="Dashboard"
          className={`${navItem} ${
            collapsed ? "justify-center px-2" : ""
          } mb-0.5 block bg-accent font-medium text-on-accent hover:bg-accent-strong`}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          {!collapsed && "Dashboard"}
        </Link>
        {links.length === 0 && !collapsed && (
          <p className="px-3 py-2 text-xs text-subtle">
            No modules assigned yet. Contact an admin.
          </p>
        )}
        {links.map((item) => {
          const Icon = MODULE_ICONS[item.href] ?? (item.module ? MODULE_ICONS[item.module] : null);
          if (!item.implemented) {
            return (
              <div
                key={item.href}
                title={collapsed ? item.label : undefined}
                className={`${navItem} cursor-default text-subtle ${collapsed ? "justify-center px-2" : ""}`}
              >
                {Icon && <Icon size={18} className="shrink-0" />}
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-strong">
                      Soon
                    </span>
                  </>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`${navItem} ${collapsed ? "justify-center px-2" : ""}`}
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              title={userName}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent"
            >
              {userName.charAt(0)}
            </span>
            <SignOutButton compact />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">
              {userName.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-muted">{userEmail}</p>
            </div>
          </div>
        )}
        {!collapsed && <SignOutButton className="mt-3 w-full" />}
      </div>
    </aside>
  );
}