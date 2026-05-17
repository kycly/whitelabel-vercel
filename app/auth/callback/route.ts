import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { claimsFromIdToken, exchangeCodeForTokens, getOauthCookieConfig } from "@/auth/cognito";
import { clearSessionCookie, writeSessionCookie } from "@/auth/session";

function loginErrorRedirect(message: string) {
  const redirectUrl = new URL("/login", "http://localhost");
  redirectUrl.searchParams.set("error", message);
  return redirectUrl.pathname + redirectUrl.search;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL(loginErrorRedirect("auth_callback_failed"), request.url));
  }

  const cookieStore = await cookies();
  const oauthCookieConfig = getOauthCookieConfig();
  const expectedState = cookieStore.get(oauthCookieConfig.stateCookieName)?.value;
  const codeVerifier = cookieStore.get(oauthCookieConfig.verifierCookieName)?.value;

  if (!expectedState || !codeVerifier || expectedState !== state) {
    return NextResponse.redirect(new URL(loginErrorRedirect("auth_state_mismatch"), request.url));
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
    const claims = claimsFromIdToken(tokenResponse.id_token ?? "");
    const response = NextResponse.redirect(new URL("/auth-loading", request.url));

    response.cookies.delete(oauthCookieConfig.stateCookieName);
    response.cookies.delete(oauthCookieConfig.verifierCookieName);

    await writeSessionCookie(response, claims);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL(loginErrorRedirect("auth_exchange_failed"), request.url));
    response.cookies.delete(oauthCookieConfig.stateCookieName);
    response.cookies.delete(oauthCookieConfig.verifierCookieName);
    clearSessionCookie(response);
    return response;
  }
}