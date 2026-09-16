import { NextRequest, NextResponse } from "next/server";

import { authCookie, createSession, ssoStateCookie } from "@/lib/auth";
import { isAllowedSsoUser } from "@/lib/login-access";
import { exchangeCodeForToken, getSsoConfig, getSsoUser } from "@/lib/sso";

function clearSsoState(response: NextResponse) {
  response.cookies.set(ssoStateCookie.name, "", {
    ...ssoStateCookie.options,
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(ssoStateCookie.name)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(
      new URL("/?login_error=sso_state", request.url),
    );

    clearSsoState(response);

    return response;
  }

  try {
    const config = getSsoConfig();

    console.log("[SSO] Exchanging authorization code...");

    const token = await exchangeCodeForToken(config, request, code);

    console.log("[SSO] Token received");

    const identifier = await getSsoUser(config, token);

    if (!(await isAllowedSsoUser(identifier))) {
      throw new Error(`Akun SSO tidak terdaftar: ${identifier}`);
    }

    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.set(
      authCookie.name,
      await createSession(identifier),
      authCookie.options,
    );

    clearSsoState(response);

    return response;
  } catch (error) {
    console.error("[SSO CALLBACK ERROR]", error);

    const response = NextResponse.redirect(
      new URL("/?login_error=sso_failed", request.url),
    );

    clearSsoState(response);

    return response;
  }
}
