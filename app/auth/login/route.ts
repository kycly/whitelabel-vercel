import { NextResponse } from "next/server";
import { createLoginRequest, getOauthCookieConfig } from "@/auth/cognito";

export async function GET() {
  const loginRequest = createLoginRequest();
  const response = NextResponse.redirect(loginRequest.authorizeUrl);
  const oauthCookieConfig = getOauthCookieConfig();

  response.cookies.set({
    name: oauthCookieConfig.stateCookieName,
    value: loginRequest.state,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: oauthCookieConfig.maxAge,
  });

  response.cookies.set({
    name: oauthCookieConfig.verifierCookieName,
    value: loginRequest.codeVerifier,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: oauthCookieConfig.maxAge,
  });

  return response;
}