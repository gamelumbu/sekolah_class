import { NextRequest, NextResponse } from "next/server";
import { ssoStateCookie } from "@/lib/auth";
import { buildAuthorizationUrl, createRandomToken, getSsoConfig, isSsoConfigured } from "@/lib/sso";

export async function GET(request: NextRequest) {
  if (!isSsoConfigured()) return NextResponse.redirect(new URL("/?login_error=sso_not_configured", request.url));

  try {
    const state = createRandomToken();
    const response = NextResponse.redirect(buildAuthorizationUrl(getSsoConfig(), request, state));
    response.cookies.set(ssoStateCookie.name, state, ssoStateCookie.options);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?login_error=sso_not_configured", request.url));
  }
}
