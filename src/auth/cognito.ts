import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/config/env";
import { buildPartnerAccessHeaders } from "@/config/partner-access";

export type VerifiedIdentityClaims = {
  sub: string;
  email: string | null;
  name: string | null;
};

export type SessionClaims = VerifiedIdentityClaims & {
  demoAccountId: string | null;
  canAccess: boolean;
};

export class PartnerDemoAccessError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getCognitoRegion(): string {
  const poolRegion = env.public.cognitoUserPoolId.split("_")[0];
  return poolRegion || env.public.awsRegion;
}

export function getCognitoIssuer(): string {
  return `https://cognito-idp.${getCognitoRegion()}.amazonaws.com/${env.public.cognitoUserPoolId}`;
}

function getCognitoJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(`${getCognitoIssuer()}/.well-known/jwks.json`));
  }

  return cachedJwks;
}

export function identityFromIdTokenPayload(payload: JWTPayload): VerifiedIdentityClaims {
  const sub = typeof payload.sub === "string" ? payload.sub : null;

  if (!sub) {
    throw new Error("Missing sub claim in Cognito id token");
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export async function resolvePartnerDemoAccess(idToken: string): Promise<Pick<SessionClaims, "demoAccountId" | "canAccess">> {
  const endpoint = new URL("/demo/me", `${env.server.kyclyMeBaseUrl}/`).toString();
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...buildPartnerAccessHeaders(env.server.cfAccessClientId, env.server.cfAccessClientSecret),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 403 || response.status === 404) {
    if (env.public.appEnv === "local") {
      console.info("[auth/session] partner demo access unresolved", {
        status: response.status,
        body,
      });
    }

    return {
      demoAccountId: null,
      canAccess: false,
    };
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "Partner demo access resolution failed";
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "PARTNER_DEMO_ACCESS_FAILED";

    throw new PartnerDemoAccessError(message, response.status, code);
  }

  const demoAccount =
    body && typeof body === "object" && "demo_account" in body && body.demo_account && typeof body.demo_account === "object"
      ? body.demo_account
      : null;

  const demoAccountId =
    demoAccount && "id" in demoAccount && typeof demoAccount.id === "string"
      ? demoAccount.id
      : null;

  if (env.public.appEnv === "local") {
    console.info("[auth/session] partner demo access resolved", {
      status: response.status,
      demoAccountId,
    });
  }

  return {
    demoAccountId,
    canAccess: demoAccountId !== null,
  };
}

export async function verifyCognitoIdToken(idToken: string): Promise<VerifiedIdentityClaims> {
  const { payload } = await jwtVerify(idToken, getCognitoJwks(), {
    issuer: getCognitoIssuer(),
    audience: env.public.cognitoAppClientId,
  });

  if (payload.token_use !== "id") {
    throw new Error("Unexpected Cognito token type");
  }

  return identityFromIdTokenPayload(payload);
}