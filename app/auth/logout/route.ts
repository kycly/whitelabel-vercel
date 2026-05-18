import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/auth/session";

function handleLogout(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  clearSessionCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}