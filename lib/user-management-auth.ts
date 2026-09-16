import { cookies } from "next/headers";
import { authCookie, verifySession } from "@/lib/auth";
import { isActiveLoginAdmin, isConfiguredMasterUser } from "@/lib/login-users-db";

export async function requireUserManager() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(authCookie.name)?.value);
  if (!session) return null;
  if (session.username === process.env.DASHBOARD_USERNAME || isConfiguredMasterUser(session.username)) return session;
  if (await isActiveLoginAdmin(session.username)) return session;
  return null;
}
