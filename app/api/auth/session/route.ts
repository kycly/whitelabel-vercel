import { NextResponse } from "next/server";
import { z } from "zod";
import { PartnerDemoAccessError, resolvePartnerDemoAccess, verifyCognitoIdToken } from "@/auth/cognito";
import { writeSessionCookie } from "@/auth/session";
import { env } from "@/config/env";

const createSessionSchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid Cognito session payload.",
        code: "INVALID_PAYLOAD",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const identity = await verifyCognitoIdToken(parsed.data.idToken);
    const access = await resolvePartnerDemoAccess(parsed.data.idToken);
    const claims = {
      ...identity,
      ...access,
    };

    if (env.public.appEnv === "local") {
      console.info("[auth/session] verified Cognito claims", {
        sub: claims.sub,
        email: claims.email,
        demoAccountId: claims.demoAccountId,
        canAccess: claims.canAccess,
      });
    }

    const response = NextResponse.json({
      authenticated: true,
      user: claims,
    });

    await writeSessionCookie(response, claims);

    return response;
  } catch (error) {
    if (error instanceof PartnerDemoAccessError) {
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
        message: "Invalid Cognito session.",
        code: "INVALID_COGNITO_SESSION",
      },
      { status: 401 },
    );
  }
}