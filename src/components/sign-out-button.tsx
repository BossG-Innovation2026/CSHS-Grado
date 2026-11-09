"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={handleSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-hover text-foreground hover:bg-accent hover:text-on-accent"
      >
        <LogOut size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className={`rounded-md bg-panel-hover px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-on-accent ${className ?? ""}`}
    >
      Sign out
    </button>
  );
}