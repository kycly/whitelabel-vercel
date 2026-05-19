import { NextResponse } from "next/server";
import { readSession } from "@/auth/session";
import { fetchKycSessionResult, KycSessionError } from "@/server/kyclink";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
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

  const { sessionId } = await context.params;

  try {
    const result = await fetchKycSessionResult({
      cognitoIdToken: session.cognitoIdToken,
      sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
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
        message: "Unexpected session result failure.",
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 },
    );
  }
}