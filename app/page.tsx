import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import LoginForm from "./login-form";
import SubjectBidirectionalEnhancer from "./subject-bidirectional-enhancer";
import { authCookie, verifySession } from "@/lib/auth";
import { readTeacherDatabase } from "@/lib/teacher-data";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(authCookie.name)?.value);

  if (!session) return <LoginForm />;
  const teachers = readTeacherDatabase();
  return <>
    <DashboardClient initialTeachers={teachers} />
    <SubjectBidirectionalEnhancer teachers={teachers} />
  </>;
}
