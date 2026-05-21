import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReadSession, mockCreateKycSession, mockFetchKycSession, mockFetchKycSessionResult, mockFetchKycSessions, mockParseKycSessionsListQuery, mockClearSessionCookie } = vi.hoisted(() => ({
  mockReadSession: vi.fn(),
  mockCreateKycSession: vi.fn(),
  mockFetchKycSession: vi.fn(),
  mockFetchKycSessionResult: vi.fn(),
  mockFetchKycSessions: vi.fn(),
  mockParseKycSessionsListQuery: vi.fn(),
  mockClearSessionCookie: vi.fn(),
}));

const mockEnv = vi.hoisted(() => ({
  server: {
    appCanonicalOrigin: null as string | null,
  },
}));

vi.mock("@/auth/session", () => ({
  readSession: mockReadSession,
  clearSessionCookie: mockClearSessionCookie,
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/server/kyclink", () => ({
  createKycSession: mockCreateKycSession,
  fetchKycSession: mockFetchKycSession,
  fetchKycSessionResult: mockFetchKycSessionResult,
  fetchKycSessions: mockFetchKycSessions,
  parseKycSessionsListQuery: mockParseKycSessionsListQuery,
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
import { GET as GET_RESULT } from "../../app/api/kyc/session/[sessionId]/result/route";
import { GET as GET_SESSIONS } from "../../app/api/kyc/sessions/route";

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
    mockParseKycSessionsListQuery.mockReturnValue({
      limit: 20,
      offset: 0,
    });
  });

  it("clears the local session cookie when upstream session creation returns 401", async () => {
    mockReadSession.mockResolvedValue({
      sub: "user-1",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo-account-1",
      canAccess: true,
      cognitoIdToken: "expired-cognito-id-token",
    });
    mockCreateKycSession.mockRejectedValue(new Error("should be replaced"));

    const { KycSessionError } = await import("@/server/kyclink");
    mockCreateKycSession.mockRejectedValue(new KycSessionError(
      "Unauthorized: missing or invalid Cognito JWT (Authorization: Bearer <token>)",
      401,
      "UNAUTHORIZED",
    ));

    const response = await POST(new Request("https://whitelabel.kycly.test/api/kyc/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(validSessionContext),
    }));

    expect(response.status).toBe(401);
    expect(mockClearSessionCookie).toHaveBeenCalledTimes(1);
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

  it("clears the local session cookie when upstream session reads return 401", async () => {
    mockReadSession.mockResolvedValue({
      sub: "user-1",
      email: "demo.user@example.com",
      name: "Demo User",
      demoAccountId: "demo-account-1",
      canAccess: true,
      cognitoIdToken: "expired-cognito-id-token",
    });

    const { KycSessionError } = await import("@/server/kyclink");
    mockFetchKycSession.mockRejectedValue(new KycSessionError("Unauthorized.", 401, "UNAUTHORIZED"));
    mockFetchKycSessionResult.mockRejectedValue(new KycSessionError("Unauthorized.", 401, "UNAUTHORIZED"));
    mockFetchKycSessions.mockRejectedValue(new KycSessionError("Unauthorized.", 401, "UNAUTHORIZED"));

    const sessionResponse = await GET(new Request("https://whitelabel.kycly.test/api/kyc/session/sess_1"), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const resultResponse = await GET_RESULT(new Request("https://whitelabel.kycly.test/api/kyc/session/sess_1/result"), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const sessionsResponse = await GET_SESSIONS(new Request("https://whitelabel.kycly.test/api/kyc/sessions?limit=20&offset=0"));

    expect(sessionResponse.status).toBe(401);
    expect(resultResponse.status).toBe(401);
    expect(sessionsResponse.status).toBe(401);
    expect(mockClearSessionCookie).toHaveBeenCalledTimes(3);
  });
});
