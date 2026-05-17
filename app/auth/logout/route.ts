import { NextResponse } from "next/server";
import { createLogoutUrl } from "@/auth/cognito";
import { clearSessionCookie } from "@/auth/session";

export async function POST() {
  const response = NextResponse.redirect(createLogoutUrl(), 303);
  clearSessionCookie(response);
  return response;
}