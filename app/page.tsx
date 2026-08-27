import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import LoginForm from "./login-form";
import SubjectBidirectionalEnhancer from "./subject-bidirectional-enhancer";
import TaskHoursExactEnhancer from "./task-hours-exact-enhancer";
import DetailBottomAnchor from "./detail-bottom-anchor";
import UploadDataEnhancer from "./upload-data-enhancer";
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
    <UploadDataEnhancer />
    <DetailBottomAnchor />
    <SubjectBidirectionalEnhancer teachers={teachers} />
    <TaskHoursExactEnhancer teachers={teachers} />
  </>;
}