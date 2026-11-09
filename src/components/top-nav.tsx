"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  Baby,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Menu,
  PenLine,
  ScrollText,
  Search,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationsMenu } from "@/components/notifications-menu";
import type { NotificationRow } from "@/server/notifications";

const MODULE_ICONS: Record<string, LucideIcon> = {
  accounts: Users,
  curriculum: BookOpen,
  classes: GraduationCap,
  grades_submit: PenLine,
  grades_approve: ClipboardCheck,
  personal_info: UserRound,
  academic_info: BookOpenCheck,
  registrar: Landmark,
  audit: ScrollText,
  parent_portal: Baby,
  codes: KeyRound,
};

const GROUP_LABELS: Record<string, string> = {
  main: "School",
  grades: "Grades",
  records: "Records",
  admin: "Administration",
};

export interface NavLink {
  href: string;
  label: string;
  shortLabel: string;
  group: string;
  module?: string;
  implemented: boolean;
}

export function TopNav({
  userName,
  userEmail,
  roleLabel,
  links,
  isDemo,
  canSearch,
  notifications,
  unreadNotifications,
}: {
  userName: string;
  userEmail: string;
  roleLabel: string;
  links: NavLink[];
  isDemo: boolean;
  canSearch: boolean;
  notifications: NotificationRow[];
  unreadNotifications: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function renderLink(item: { href: string; label: string; shortLabel?: string; module?: string }) {
    const Icon = item.module ? MODULE_ICONS[item.module] : LayoutDashboard;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        onClick={() => {
          setMobileOpen(false);
          setMenuOpen(false);
        }}
        aria-current={active ? "page" : undefined}
        className={`group relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-accent text-on-accent"
            : "text-muted hover:bg-panel-hover hover:text-foreground"
        }`}
      >
        {Icon && <Icon size={15} className="shrink-0" />}
        <span className="whitespace-nowrap">{item.shortLabel ?? item.label}</span>
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-panel text-accent transition-colors group-hover:border-accent/60 group-hover:bg-selected">
            <GraduationCap size={21} />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-extrabold tracking-[0.2em] text-foreground">GRADO</span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-subtle">
              Cabiao SHS · Academic Tracking
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {renderLink({ href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard" })}
          {links.map((item, index) => {
            const previous = index > 0 ? links[index - 1].group : "main";
            const separator = item.group !== previous;
            return (
              <span key={item.href} className="flex shrink-0 items-center">
                {separator && <span aria-hidden className="mx-1 h-5 w-px bg-border" />}
                {item.implemented ? (
                  renderLink(item)
                ) : (
                  <span
                    title={`${item.label} — coming soon`}
                    className="flex shrink-0 cursor-default items-center gap-1.5 rounded-md px-3 py-2 text-[13px] text-subtle"
                  >
                    {MODULE_ICONS[item.module ?? ""] &&
                      (() => {
                        const Icon = MODULE_ICONS[item.module ?? ""];
                        return <Icon size={15} />;
                      })()}
                    <span className="whitespace-nowrap">{item.shortLabel}</span>
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-strong">
                      soon
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isDemo && (
            <span className="hidden items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-strong sm:flex">
              <BadgeCheck size={13} /> Demo · fake data
            </span>
          )}

          {canSearch && (
            <form
              action="/students"
              className="hidden items-center gap-2 rounded-md border border-border bg-input px-3 py-1.5 text-xs transition-colors focus-within:border-accent xl:flex"
            >
              <Search size={14} className="shrink-0 text-subtle" />
              <input
                name="q"
                placeholder="Find a student…"
                aria-label="Find a student"
                className="w-36 bg-transparent text-xs text-foreground outline-none placeholder:text-subtle"
              />
              <button type="submit" aria-label="Search students" className="text-subtle hover:text-accent">
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <NotificationsMenu notifications={notifications} unread={unreadNotifications} />

          <SignOutButton compact />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md border border-border bg-panel py-1 pl-1 pr-2 text-left transition-colors hover:border-accent/50 hover:bg-panel-hover"
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-xs font-bold text-on-accent">
                {initials || userName.charAt(0)}
              </span>
              <span className="hidden max-w-28 truncate text-xs font-semibold text-foreground md:block">{userName}</span>
              <ChevronDown size={14} className={`text-subtle transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 w-64 overflow-hidden rounded-lg border border-border bg-surface"
              >
                <div className="border-b border-border bg-panel/50 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                  <p className="truncate text-xs text-muted">{userEmail}</p>
                  <span className="mt-2 inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
                    {roleLabel}
                  </span>
                </div>
                <div className="p-2">
                  <SignOutButton className="w-full justify-center" />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 place-items-center rounded-md border border-border bg-panel text-foreground lg:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="max-h-[75vh] overflow-y-auto border-t border-border px-4 pb-6 pt-3 lg:hidden">
          <div className="grid gap-1">
            {renderLink({ href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard" })}
            {links.map((item, index) => {
              const previous = index > 0 ? links[index - 1].group : "main";
              const separator = item.group !== previous;
              return (
                <div key={item.href}>
                  {separator && (
                    <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-subtle">
                      {GROUP_LABELS[item.group] ?? item.group}
                    </p>
                  )}
                  {item.implemented ? (
                    renderLink(item)
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-subtle">
                      {item.label} · soon
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <SignOutButton className="w-full justify-center" />
          </div>
        </nav>
      )}
    </header>
  );
}
