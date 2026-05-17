import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    public: {},
    server: {
      sessionSecret: "test-secret",
      cognitoClientSecret: undefined,
      kyclyApiBaseUrl: "https://api.kycly.test",
      demoAccountKeyMap: {
        demo_account_1: "ck_demo_123456",
      },
      defaultKycLinkTheme: "kycly-light",
    },
  },
  getDemoAccountApiKey: (demoAccountId: string) => {
    return demoAccountId === "demo_account_1" ? "ck_demo_123456" : null;
  },
}));

import {
  createKycSession,
  fetchKycSessionResult,
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

  it("authenticates session creation against the backend with the mapped demo API key", async () => {
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
      demoAccountId: "demo_account_1",
      input: baseInput,
    });

    expect(created.sessionId).toBe("sess_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      externalId: string;
      metadata: {
        businessContext: Record<string, string>;
        routingContext: Record<string, string>;
        notificationContext?: Record<string, string>;
        customContext?: Record<string, string>;
      };
    };

    expect(url).toBe("https://api.kycly.test/kyclink/create");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ck_demo_123456");
    expect(body.externalId).toBe("cust_0042");
    expect(body.metadata.routingContext.journey).toBe("onboarding");
    expect(body.metadata.notificationContext?.preferredChannel).toBe("email");
    expect(body.metadata.customContext).toEqual({ campaign: "spring_demo" });
  });

  it("authenticates session result reads against the backend with the mapped demo API key", async () => {
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
      demoAccountId: "demo_account_1",
      sessionId: "sess_1",
    });

    expect(result.validationStatus).toBe("APPROVED");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kycly.test/kyclink/sess_1/result");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ck_demo_123456");
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
      demoAccountId: "demo_account_1",
      query: parseKycSessionsListQuery(new URLSearchParams("status=completed&decisionStatus=APPROVED")),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sessionId).toBe("sess_1");
    expect(result.meta.total).toBe(1);
    expect(result.meta.statusCounts.completed).toBe(1);
    expect(result.meta.decisionCounts.APPROVED).toBe(1);
  });
});