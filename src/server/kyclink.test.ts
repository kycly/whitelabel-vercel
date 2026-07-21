import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    public: {},
    server: {
      sessionSecret: "test-secret",
      kyclyBaseUrl: "https://api.kycly.test",
      defaultKycLinkTheme: "kycly-light",
      cfAccessClientId: "test-cf-id.access",
      cfAccessClientSecret: "test-cf-secret",
    },
  },
}));

import {
  createKycSession,
  fetchKycSessionResult,
  fetchKycSessionResultWithFallback,
  fetchKycSessions,
  parseKycSessionsListQuery,
} from "@/server/kyclink";
import type { SessionContextInput } from "@/lib/verification";

const baseInput: SessionContextInput = {
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
  customContextEntries: [{ key: "campaign", value: "spring_demo" }],
};

describe("server/kyclink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates session creation against the backend with the Cognito id token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: "sess_1",
        kyclinkUrl: "https://kyclink.example.com/session/sess_1",
        expiresAt: "2026-05-17T12:00:00.000Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const created = await createKycSession({
      cognitoIdToken: "cognito-id-token",
      input: baseInput,
      parentOrigin: "https://app.example.com",
    });

    expect(created.sessionId).toBe("sess_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      externalId: string;
      parentOrigin: string;
      metadata: {
        businessContext: Record<string, string>;
        routingContext: Record<string, string>;
        notificationContext?: Record<string, string>;
        customContext?: Record<string, string>;
      };
    };

    expect(url).toBe("https://api.kycly.test/kyclink/create");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cognito-id-token");
    expect((init.headers as Record<string, string>)["CF-Access-Client-Id"]).toBe("test-cf-id.access");
    expect((init.headers as Record<string, string>)["CF-Access-Client-Secret"]).toBe("test-cf-secret");
    expect(body.externalId).toBe("cust_0042");
    expect(body.parentOrigin).toBe("https://app.example.com");
    expect(body.metadata.routingContext.journey).toBe("onboarding");
    expect(body.metadata.notificationContext?.preferredChannel).toBe("email");
    expect(body.metadata.customContext).toEqual({ campaign: "spring_demo" });
  });

  it("authenticates session result reads against the backend with the Cognito id token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: "sess_1",
        externalId: "cust_0042",
        status: "completed",
        completed: true,
        completedAt: "2026-05-17T12:03:00.000Z",
        validationStatus: "APPROVED",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessionResult({
      cognitoIdToken: "cognito-id-token",
      sessionId: "sess_1",
    });

    expect(result.validationStatus).toBe("APPROVED");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kycly.test/kyclink/sess_1/result");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cognito-id-token");
  });

  it("falls back to the sessions index when the upstream result route returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: "KycLink session not found",
          code: "KYCLINK_SESSION_NOT_FOUND",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              session_id: "sess_1",
              external_id: "cust_0042",
              status: "processing",
              expires_at: null,
              completed_at: null,
              created_at: "2026-05-17T12:00:00.000Z",
            },
          ],
          meta: {
            returned: 1,
            limit: 50,
            offset: 0,
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessionResultWithFallback({
      cognitoIdToken: "cognito-id-token",
      sessionId: "sess_1",
    });

    expect(result).toEqual({
      sessionId: "sess_1",
      externalId: "cust_0042",
      status: "processing",
      completed: false,
      completedAt: null,
      validationStatus: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.kycly.test/kyclink/sess_1/result");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.kycly.test/kyclink/sessions?limit=50&offset=0");
  });

  it("uses the sessions list endpoint and result endpoint together to compute canonical filtered history", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              session_id: "sess_1",
              external_id: "cust_0042",
              status: "completed",
              expires_at: null,
              completed_at: "2026-05-17T12:03:00.000Z",
              created_at: "2026-05-17T12:00:00.000Z",
            },
            {
              session_id: "sess_2",
              external_id: "cust_0043",
              status: "processing",
              expires_at: null,
              completed_at: null,
              created_at: "2026-05-17T12:05:00.000Z",
            },
          ],
          meta: {
            returned: 2,
            limit: 50,
            offset: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: "sess_1",
          externalId: "cust_0042",
          status: "completed",
          completed: true,
          completedAt: "2026-05-17T12:03:00.000Z",
          validationStatus: "APPROVED",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessions({
      cognitoIdToken: "cognito-id-token",
      query: parseKycSessionsListQuery(new URLSearchParams("status=completed&decisionStatus=APPROVED")),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sessionId).toBe("sess_1");
    expect(result.meta.total).toBe(1);
    expect(result.meta.statusCounts.completed).toBe(1);
    expect(result.meta.decisionCounts.APPROVED).toBe(1);
  });

  it("keeps the canonical createdAt DESC order before pagination", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              session_id: "sess_old",
              external_id: "cust_0040",
              status: "pending",
              expires_at: null,
              completed_at: null,
              created_at: "2026-05-17T12:00:00.000Z",
            },
            {
              session_id: "sess_new",
              external_id: "cust_0041",
              status: "pending",
              expires_at: null,
              completed_at: null,
              created_at: "2026-05-17T12:10:00.000Z",
            },
            {
              session_id: "sess_mid",
              external_id: "cust_0042",
              status: "pending",
              expires_at: null,
              completed_at: null,
              created_at: "2026-05-17T12:05:00.000Z",
            },
          ],
          meta: {
            returned: 3,
            limit: 50,
            offset: 0,
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessions({
      cognitoIdToken: "cognito-id-token",
      query: parseKycSessionsListQuery(new URLSearchParams("limit=2")),
    });

    expect(result.data.map((item) => item.sessionId)).toEqual(["sess_new", "sess_mid"]);
    expect(result.meta.total).toBe(3);
  });
});