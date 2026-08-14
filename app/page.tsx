import { cookies } from "next/headers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import DashboardClient, { type Teacher } from "./dashboard-client";
import LoginForm from "./login-form";
import { authCookie, verifySession } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(authCookie.name)?.value);

  if (!session) return <LoginForm />;
  const compressed = readFileSync(join(process.cwd(), "app", "data", "teachers.json.gz"));
  const teachers = JSON.parse(gunzipSync(compressed).toString("utf8")) as Teacher[];
  return <DashboardClient initialTeachers={teachers} />;
}
