import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { readSession } from "@/auth/session";
import {
  fetchKycSessions,
  KycSessionError,
  parseKycSessionsListQuery,
} from "@/server/kyclink";

export async function GET(request: Request) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json(
      {
        message: "Unauthorized.",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  if (!session.canAccess || !session.demoAccountId) {
    return NextResponse.json(
      {
        message: "Access denied for this demo account.",
        code: "ACCESS_DENIED",
      },
      { status: 403 },
    );
  }

  try {
    const query = parseKycSessionsListQuery(new URL(request.url).searchParams);
    const result = await fetchKycSessions({
      cognitoIdToken: session.cognitoIdToken,
      query,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Invalid sessions list query.",
          code: "INVALID_QUERY",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof KycSessionError) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        message: "Unexpected sessions list failure.",
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 },
    );
  }
}