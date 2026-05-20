import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReadSession, mockCreateKycSession, mockFetchKycSession } = vi.hoisted(() => ({
  mockReadSession: vi.fn(),
  mockCreateKycSession: vi.fn(),
  mockFetchKycSession: vi.fn(),
}));

const mockEnv = vi.hoisted(() => ({
  server: {
    appCanonicalOrigin: null as string | null,
  },
}));

vi.mock("@/auth/session", () => ({
  readSession: mockReadSession,
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/server/kyclink", () => ({
  createKycSession: mockCreateKycSession,
  fetchKycSession: mockFetchKycSession,
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
import { GET } from "../../app/api/kyc/session/[sessionId]/route";

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
    mockEnv.server.appCanonicalOrigin = null;
  });

  it("prefers the configured canonical origin when forwarding parentOrigin to partner-node", async () => {
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
    mockEnv.server.appCanonicalOrigin = "https://app.kycly.example";

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
        parentOrigin: "https://app.kycly.example",
      }),
    );
  });

  it("prefers forwarded headers to derive parentOrigin when no canonical origin is configured", async () => {
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
        "x-forwarded-host": "customer-preview.vercel.app",
        "x-forwarded-proto": "https",
        origin: "https://portal.customer.test",
      },
      body: JSON.stringify(validSessionContext),
    }));

    expect(response.status).toBe(201);
    expect(mockCreateKycSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cognitoIdToken: "cognito-id-token",
        parentOrigin: "https://customer-preview.vercel.app",
      }),
    );
  });

  it("falls back to the request URL origin when forwarded headers are absent", async () => {
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

  it("forwards canonical session reads to the backend with the requested session id", async () => {
    mockReadSession.mockResolvedValue({
      sub: "user-1",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo-account-1",
      canAccess: true,
      cognitoIdToken: "cognito-id-token",
    });
    mockFetchKycSession.mockResolvedValue({
      sessionId: "sess_1",
      externalId: "cust_0042",
      kyclinkUrl: "https://kyclink.example.com/session/sess_1",
      status: "processing",
      expiresAt: "2026-05-18T13:00:00.000Z",
      completedAt: null,
      workflowStatus: "IN_REVIEW",
      sessionState: "ACTIVE",
      resumeAvailable: true,
    });

    const response = await GET(new Request("https://whitelabel.kycly.test/api/kyc/session/sess_1"), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockFetchKycSession).toHaveBeenCalledWith({
      cognitoIdToken: "cognito-id-token",
      sessionId: "sess_1",
    });
  });
});
