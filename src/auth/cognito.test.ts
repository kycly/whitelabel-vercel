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

import { getCognitoIssuer, identityFromIdTokenPayload } from "@/auth/cognito";

describe("auth/cognito", () => {
  it("resolves the Cognito issuer from the user pool id", () => {
    expect(getCognitoIssuer()).toBe("https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_demoPool");
  });

  it("extracts identity claims from a verified Cognito payload", () => {
    expect(identityFromIdTokenPayload({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
    })).toEqual({
      sub: "user-123",
      email: "demo.user@example.com",
      name: "Demo User",
    });
  });

  it("rejects a payload missing sub", () => {
    expect(() => identityFromIdTokenPayload({ email: "demo.user@example.com" })).toThrow(
      "Missing sub claim in Cognito id token",
    );
  });
});