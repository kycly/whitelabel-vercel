import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/config/env";

export type SessionClaims = {
  sub: string;
  email: string | null;
  name: string | null;
  demoAccountId: string | null;
  canAccess: boolean;
};

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

export function claimsFromIdTokenPayload(payload: JWTPayload): SessionClaims {
  const sub = typeof payload.sub === "string" ? payload.sub : null;

  if (!sub) {
    throw new Error("Missing sub claim in Cognito id token");
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    demoAccountId:
      typeof payload["custom:demo_account_id"] === "string"
        ? String(payload["custom:demo_account_id"])
        : null,
    canAccess: String(payload["custom:kyc_demo_access"] ?? "false") === "true",
  };
}

export async function verifyCognitoIdToken(idToken: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(idToken, getCognitoJwks(), {
    issuer: getCognitoIssuer(),
    audience: env.public.cognitoAppClientId,
  });

  if (payload.token_use !== "id") {
    throw new Error("Unexpected Cognito token type");
  }

  return claimsFromIdTokenPayload(payload);
}