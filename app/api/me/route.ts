import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { readSession } from "@/auth/session";

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        message: "No active session.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    appEnv: env.public.appEnv,
    user: {
      sub: session.sub,
      email: session.email,
      name: session.name,
      demoAccountId: session.demoAccountId,
      canAccess: session.canAccess,
    },
  });
}