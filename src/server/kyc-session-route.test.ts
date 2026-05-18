import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReadSession, mockCreateKycSession } = vi.hoisted(() => ({
  mockReadSession: vi.fn(),
  mockCreateKycSession: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  readSession: mockReadSession,
}));

vi.mock("@/server/kyclink", () => ({
  createKycSession: mockCreateKycSession,
  KycSessionError: class KycSessionError extends Error {
    statusCode: number;
    code: string;

    constructor(message: string, statusCode: number, code: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

import { POST } from "../../app/api/kyc/session/route";

const validSessionContext = {
  scenario: "onboarding",
  verificationType: "onboarding",
  referenceClient: "cust 0042",
  country: "SN",
  countryOther: "",
  product: "premium_account",
  productOther: "",
  segment: "retail",
  priority: "standard",
  notificationEmail: "demo.user@example.com",
  notificationPhone: "",
  notificationChannel: "email",
  customContextEntries: [],
};

describe("api/kyc/session route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the Origin header when forwarding parentOrigin to partner-node", async () => {
    mockReadSession.mockResolvedValue({
      sub: "user-1",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo-account-1",
      canAccess: true,
      cognitoIdToken: "cognito-id-token",
    });
    mockCreateKycSession.mockResolvedValue({
      sessionId: "sess_1",
      kyclinkUrl: "https://kyclink.example.com/session/sess_1",
      expiresAt: "2026-05-18T13:00:00.000Z",
    });

    const response = await POST(new Request("https://whitelabel.kycly.test/api/kyc/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://portal.customer.test",
      },
      body: JSON.stringify(validSessionContext),
    }));

    expect(response.status).toBe(201);
    expect(mockCreateKycSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitoIdToken: "cognito-id-token",
        parentOrigin: "https://portal.customer.test",
      }),
    );
  });

  it("falls back to the request URL origin when the Origin header is absent", async () => {
    mockReadSession.mockResolvedValue({
      sub: "user-1",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo-account-1",
      canAccess: true,
      cognitoIdToken: "cognito-id-token",
    });
    mockCreateKycSession.mockResolvedValue({
      sessionId: "sess_2",
      kyclinkUrl: "https://kyclink.example.com/session/sess_2",
      expiresAt: "2026-05-18T13:00:00.000Z",
    });

    const response = await POST(new Request("https://whitelabel.kycly.test/api/kyc/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(validSessionContext),
    }));

    expect(response.status).toBe(201);
    expect(mockCreateKycSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitoIdToken: "cognito-id-token",
        parentOrigin: "https://whitelabel.kycly.test",
      }),
    );
  });
});