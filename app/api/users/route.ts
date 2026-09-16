import { NextResponse } from "next/server";

import { listLoginUsers, upsertLoginUser } from "@/lib/login-users-db";

import { requireUserManager } from "@/lib/user-management-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireUserManager();

  if (!session) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  try {
    const users = await listLoginUsers();

    return NextResponse.json({ users });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca user.";

    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireUserManager();

  if (!session) {
    return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });
  }

  try {
    const body = await request.json();

    const user = await upsertLoginUser({
      username: String(body.username || ""),
      email: String(body.email || ""),
      fullName: String(body.fullName || ""),
      role: body.role === "admin" ? "admin" : "user",
      active: body.active !== false,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan user.";

    return NextResponse.json({ message }, { status: 400 });
  }
}
