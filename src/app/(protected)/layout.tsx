import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { NAV_LINKS, getPermissions, ROLE_LABELS } from "@/lib/access";
import { TopNav } from "@/components/top-nav";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const permissions = getPermissions(user);
  const links = NAV_LINKS.filter((l) => permissions.includes(l.module)).map((l) => ({
    href: l.href,
    label: l.label,
    shortLabel: l.shortLabel,
    group: l.group,
    module: l.module,
    implemented: l.implemented,
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopNav
        userName={user.name}
        userEmail={user.email}
        roleLabel={ROLE_LABELS[user.role] ?? user.role}
        links={links}
        isDemo={isDemoMode()}
        canSearch={permissions.includes("personal_info") || permissions.includes("registrar")}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
