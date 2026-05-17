import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "@/config/env";

const SESSION_COOKIE_NAME = "kycly_whitelabel_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const sessionSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().min(1).nullable(),
  demoAccountId: z.string().min(1).nullable(),
  canAccess: z.boolean(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type AppSession = z.infer<typeof sessionSchema>;

type SessionInput = Omit<AppSession, "iat" | "exp">;

function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(env.server.sessionSecret);
}

export async function createSessionToken(input: SessionInput): Promise<string> {
  return new SignJWT(input)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function readSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    return sessionSchema.parse(payload);
  } catch {
    return null;
  }
}

export async function writeSessionCookie(response: NextResponse, input: SessionInput): Promise<void> {
  const token = await createSessionToken(input);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires: new Date(0),
  });
}