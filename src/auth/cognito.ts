import { createHash, randomBytes } from "node:crypto";
import { decodeJwt } from "jose";
import { env } from "@/config/env";

const STATE_COOKIE_NAME = "kycly_cognito_state";
const VERIFIER_COOKIE_NAME = "kycly_cognito_verifier";
const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type SessionClaims = {
  sub: string;
  email: string | null;
  name: string | null;
  demoAccountId: string | null;
  canAccess: boolean;
};

function buildPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function createLoginRequest() {
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = buildPkceChallenge(codeVerifier);

  const authorizeUrl = new URL(`${env.public.cognitoDomain}/oauth2/authorize`);
  authorizeUrl.searchParams.set("client_id", env.public.cognitoAppClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", env.public.cognitoRedirectSignIn);
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);

  return {
    state,
    codeVerifier,
    authorizeUrl: authorizeUrl.toString(),
  };
}

export function getOauthCookieConfig() {
  return {
    stateCookieName: STATE_COOKIE_NAME,
    verifierCookieName: VERIFIER_COOKIE_NAME,
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  } as const;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const tokenUrl = `${env.public.cognitoDomain}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.public.cognitoAppClientId,
    code,
    redirect_uri: env.public.cognitoRedirectSignIn,
    code_verifier: codeVerifier,
  });

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (env.server.cognitoClientSecret) {
    const basic = Buffer.from(
      `${env.public.cognitoAppClientId}:${env.server.cognitoClientSecret}`,
      "utf-8",
    ).toString("base64");
    headers.set("Authorization", `Basic ${basic}`);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as TokenResponse & { error?: string; error_description?: string };

  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Cognito token exchange failed");
  }

  return payload;
}

export function claimsFromIdToken(idToken: string): SessionClaims {
  const decoded = decodeJwt(idToken) as Record<string, unknown>;
  const sub = typeof decoded.sub === "string" ? decoded.sub : null;

  if (!sub) {
    throw new Error("Missing sub claim in Cognito id token");
  }

  return {
    sub,
    email: typeof decoded.email === "string" ? decoded.email : null,
    name: typeof decoded.name === "string" ? decoded.name : null,
    demoAccountId:
      typeof decoded["custom:demo_account_id"] === "string"
        ? String(decoded["custom:demo_account_id"])
        : null,
    canAccess: String(decoded["custom:kyc_demo_access"] ?? "false") === "true",
  };
}

export function createLogoutUrl(): string {
  const logoutUrl = new URL(`${env.public.cognitoDomain}/logout`);
  logoutUrl.searchParams.set("client_id", env.public.cognitoAppClientId);
  logoutUrl.searchParams.set("logout_uri", env.public.cognitoRedirectSignOut);
  return logoutUrl.toString();
}