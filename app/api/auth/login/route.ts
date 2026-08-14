import { NextResponse } from "next/server";
import { authCookie, createSession, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({ username: "", password: "" }));
  if (typeof username !== "string" || typeof password !== "string" || !validateCredentials(username, password)) {
    return NextResponse.json({ message: "Nama pengguna atau kata sandi tidak sesuai." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookie.name, await createSession(username), authCookie.options);
  return response;
}
