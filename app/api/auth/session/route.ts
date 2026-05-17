import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCognitoIdToken } from "@/auth/cognito";
import { writeSessionCookie } from "@/auth/session";

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
    const claims = await verifyCognitoIdToken(parsed.data.idToken);
    const response = NextResponse.json({
      authenticated: true,
      user: claims,
    });

    await writeSessionCookie(response, claims);

    return response;
  } catch {
    return NextResponse.json(
      {
        message: "Invalid Cognito session.",
        code: "INVALID_COGNITO_SESSION",
      },
      { status: 401 },
    );
  }
}