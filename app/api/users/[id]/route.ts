import { NextResponse } from "next/server";
import { deleteLoginUser, setLoginUserActive } from "@/lib/login-users-db";
import { requireUserManager } from "@/lib/user-management-auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const session = await requireUserManager();
  if (!session) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await request.json();
    const user = await setLoginUserActive(Number(id), Boolean(body.active));
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui user.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const session = await requireUserManager();
  if (!session) return NextResponse.json({ message: "Tidak diizinkan." }, { status: 403 });

  try {
    const { id } = await context.params;
    await deleteLoginUser(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghapus user.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
