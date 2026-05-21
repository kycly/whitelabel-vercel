import { NextResponse } from "next/server";
import { readSession } from "@/auth/session";
import { fetchKycSession, KycSessionError } from "@/server/kyclink";
import { createKycErrorResponse, createUnauthorizedKycResponse } from "@/server/kyc-route-response";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await readSession();

  if (!session) {
    return createUnauthorizedKycResponse();
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
    const result = await fetchKycSession({
      cognitoIdToken: session.cognitoIdToken,
      sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KycSessionError) {
      return createKycErrorResponse(error);
    }

    return NextResponse.json(
      {
        message: "Unexpected session read failure.",
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 },
    );
  }
}