import { NextRequest, NextResponse } from "next/server";
import { authCookie, createSession, ssoStateCookie } from "@/lib/auth";
import { isAllowedSsoUser } from "@/lib/login-access";
import { exchangeCodeForToken, getSsoConfig, getSsoUser } from "@/lib/sso";

function clearSsoState(response: NextResponse) {
  response.cookies.set(ssoStateCookie.name, "", { ...ssoStateCookie.options, maxAge: 0 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(ssoStateCookie.name)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(new URL("/?login_error=sso_state", request.url));
    clearSsoState(response);
    return response;
  }

  try {
    const config = getSsoConfig();
    const token = await exchangeCodeForToken(config, request, code);
    const username = await getSsoUser(config, token);
    if (!isAllowedSsoUser(username)) throw new Error("Akun SSO tidak terdaftar di data guru.");
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(authCookie.name, await createSession(username), authCookie.options);
    clearSsoState(response);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/?login_error=sso_failed", request.url));
    clearSsoState(response);
    return response;
  }
}
