import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import LoginForm from "./login-form";
import SubjectBidirectionalEnhancer from "./subject-bidirectional-enhancer";
import BKWorkloadEnhancer from "./bk-workload-enhancer";
import { authCookie, verifySession } from "@/lib/auth";
import { readTeacherDatabase } from "@/lib/teacher-data";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(authCookie.name)?.value);

  if (!session) return <LoginForm />;
  const teachers = readTeacherDatabase();
  return <>
    <style>{`.chart-card:has(.wakasek-teacher-table) { display: none !important; }`}</style>
    <DashboardClient initialTeachers={teachers} />
    <SubjectBidirectionalEnhancer teachers={teachers} />
    <BKWorkloadEnhancer teachers={teachers} />
  </>;
}
