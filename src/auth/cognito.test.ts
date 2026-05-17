import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    public: {
      awsRegion: "eu-west-1",
      cognitoAppClientId: "demo-client-id",
      cognitoUserPoolId: "eu-west-1_demoPool",
    },
    server: {},
  },
}));

import { claimsFromIdTokenPayload, getCognitoIssuer } from "@/auth/cognito";

describe("auth/cognito", () => {
  it("resolves the Cognito issuer from the user pool id", () => {
    expect(getCognitoIssuer()).toBe("https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_demoPool");
  });

  it("extracts demo claims from a verified Cognito payload", () => {
    expect(claimsFromIdTokenPayload({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
      "custom:demo_account_id": "demo_account_1",
      "custom:kyc_demo_access": "true",
    })).toEqual({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo_account_1",
      canAccess: true,
    });
  });

  it("rejects a payload missing sub", () => {
    expect(() => claimsFromIdTokenPayload({ email: "demo.user@example.com" })).toThrow(
      "Missing sub claim in Cognito id token",
    );
  });
});