import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { can, isAdmin, type ModuleKey } from "@/lib/modules";

export * from "@/lib/modules";

export async function requireModule(module: ModuleKey): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user, module)) redirect("/dashboard");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}
