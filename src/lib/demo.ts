import "server-only";
import { getEnvVar } from "@/lib/env";
import demo from "@/demo/accounts.json";

export interface DemoAccount {
  role: string;
  roleLabel: string;
  email: string;
  password: string;
  summary: string;
}

/**
 * Demo mode is switched on per deployment (DEMO_MODE=true on the demo Worker
 * only). The real site never shows demo accounts, even if they existed there.
 */
export function isDemoMode(): boolean {
  return getEnvVar("DEMO_MODE") === "true";
}

/** One-click sign-in options for the demo login page (empty outside demo mode). */
export function demoAccounts(): DemoAccount[] {
  if (!isDemoMode()) return [];
  return demo.accounts.map((a) => ({
    role: a.role,
    roleLabel: a.label,
    email: a.email,
    password: demo.password,
    summary: a.summary,
  }));
}

/** How students and parents get in (shown on the demo login page). */
export function demoStudentParentNote(): string | null {
  return isDemoMode() ? demo.studentParent : null;
}
