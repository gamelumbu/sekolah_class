import { NextResponse } from "next/server";
import { authCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(authCookie.name, "", { ...authCookie.options, maxAge: 0 });
  return response;
}
