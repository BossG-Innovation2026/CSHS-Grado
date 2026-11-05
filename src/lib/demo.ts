import "server-only";
import { getEnvVar } from "@/lib/env";
import demo from "@/demo/accounts.json";
import { ROLE_LABELS } from "@/lib/modules";

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
    roleLabel: ROLE_LABELS[a.role] ?? a.role,
    email: a.email,
    password: demo.password,
    summary: a.summary,
  }));
}
