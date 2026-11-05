import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string;
  active: boolean;
  image?: string | null;
}

/** The signed-in, active user for this request, or null. Memoized per render. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const requestHeaders = await headers();
  if (!requestHeaders.get("cookie")) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session?.user) return null;
  const user = session.user as unknown as SessionUser;
  if (!user.active) return null;
  return user;
});
