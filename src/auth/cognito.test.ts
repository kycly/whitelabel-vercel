import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    public: {
      cognitoAppClientId: "demo-client-id",
      cognitoDomain: "https://demo.auth.eu-west-1.amazoncognito.com",
      cognitoRedirectSignIn: "https://whitelabel.example.com/auth/callback",
      cognitoRedirectSignOut: "https://whitelabel.example.com/login",
    },
    server: {
      cognitoClientSecret: "super-secret",
    },
  },
}));

import { claimsFromIdToken, createLoginRequest, createLogoutUrl, exchangeCodeForTokens } from "@/auth/cognito";

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf-8").toString("base64url");
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${header}.${body}.`;
}

describe("auth/cognito", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a PKCE login request with Cognito authorize params", () => {
    const loginRequest = createLoginRequest();
    const authorizeUrl = new URL(loginRequest.authorizeUrl);

    expect(authorizeUrl.origin).toBe("https://demo.auth.eu-west-1.amazoncognito.com");
    expect(authorizeUrl.pathname).toBe("/oauth2/authorize");
    expect(authorizeUrl.searchParams.get("client_id")).toBe("demo-client-id");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe("https://whitelabel.example.com/auth/callback");
    expect(authorizeUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("state")).toBe(loginRequest.state);
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(loginRequest.codeVerifier.length).toBeGreaterThan(20);
  });

  it("extracts demo claims from the Cognito id token payload", () => {
    const idToken = buildUnsignedJwt({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
      "custom:demo_account_id": "demo_account_1",
      "custom:kyc_demo_access": "true",
    });

    expect(claimsFromIdToken(idToken)).toEqual({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo_account_1",
      canAccess: true,
    });
  });

  it("uses basic auth when exchanging the code with Cognito", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id_token: "id-token",
        access_token: "access-token",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await exchangeCodeForTokens("auth-code", "pkce-verifier");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://demo.auth.eu-west-1.amazoncognito.com/oauth2/token");
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe(
      `Basic ${Buffer.from("demo-client-id:super-secret", "utf-8").toString("base64")}`,
    );
    expect(createLogoutUrl()).toBe(
      "https://demo.auth.eu-west-1.amazoncognito.com/logout?client_id=demo-client-id&logout_uri=https%3A%2F%2Fwhitelabel.example.com%2Flogin",
    );
  });
});