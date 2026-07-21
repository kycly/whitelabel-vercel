import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/auth/session";
import { KycSessionError } from "@/server/kyclink";

export function createUnauthorizedKycResponse(): NextResponse {
  const response = NextResponse.json(
    {
      message: "Unauthorized.",
      code: "UNAUTHORIZED",
    },
    { status: 401 },
  );

  clearSessionCookie(response);
  return response;
}

export function createKycErrorResponse(error: KycSessionError): NextResponse {
  const response = NextResponse.json(
    {
      message: error.message,
      code: error.code,
    },
    { status: error.statusCode },
  );

  if (error.statusCode === 401) {
    clearSessionCookie(response);
  }

  return response;
}