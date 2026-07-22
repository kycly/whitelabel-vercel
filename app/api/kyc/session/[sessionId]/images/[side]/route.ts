import { NextResponse } from "next/server";
import { readSession } from "@/auth/session";
import { fetchKycVerificationImage, KycSessionError } from "@/server/kyclink";
import { createKycErrorResponse, createUnauthorizedKycResponse } from "@/server/kyc-route-response";

type RouteContext = { params: Promise<{ sessionId: string; side: string }> };

const ALLOWED_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);

export async function GET(_request: Request, context: RouteContext) {
  const session = await readSession();
  if (!session) {
    return createUnauthorizedKycResponse();
  }
  if (!session.canAccess || !session.demoAccountId) {
    return NextResponse.json({ message: "Access denied for this demo account.", code: "ACCESS_DENIED" }, { status: 403 });
  }

  const { sessionId, side } = await context.params;
  try {
    const image = await fetchKycVerificationImage({ cognitoIdToken: session.cognitoIdToken, sessionId, side });

    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(image.contentType)) {
      return NextResponse.json(
        { message: "Unexpected verification image content type.", code: "UNEXPECTED_IMAGE_CONTENT_TYPE" },
        { status: 502 },
      );
    }

    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof KycSessionError) {
      return createKycErrorResponse(error);
    }
    return NextResponse.json({ message: "Unexpected verification image failure.", code: "UNEXPECTED_ERROR" }, { status: 500 });
  }
}
