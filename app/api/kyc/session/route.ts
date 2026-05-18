import { NextResponse } from "next/server";
import { readSession } from "@/auth/session";
import { createKycSession, KycSessionError } from "@/server/kyclink";
import { sessionContextSchema } from "@/lib/verification";

export async function POST(request: Request) {
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

  const body = await request.json();
  const parsed = sessionContextSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid session context payload.",
        code: "INVALID_PAYLOAD",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const requestOrigin = request.headers.get("origin") ?? new URL(request.url).origin;
    const created = await createKycSession({
      cognitoIdToken: session.cognitoIdToken,
      input: parsed.data,
      parentOrigin: requestOrigin,
    });

    return NextResponse.json(created, { status: 201 });
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
        message: "Unexpected session creation failure.",
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 },
    );
  }
}