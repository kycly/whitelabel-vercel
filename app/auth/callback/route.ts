import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", "legacy_callback_route");
  return NextResponse.redirect(redirectUrl, 307);
}