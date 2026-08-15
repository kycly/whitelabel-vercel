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
  fetchKycSession,
  fetchKycSessions,
  fetchKycVerificationDetail,
  fetchKycVerificationImage,
  KycSessionError,
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

  it("authenticates canonical session reads against the backend with the Cognito id token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: "sess_1",
        externalId: "cust_0042",
        kyclinkUrl: "https://kyclink.example.com/session/sess_1",
        status: "processing",
        expiresAt: "2026-05-17T12:30:00.000Z",
        completedAt: null,
        workflowStatus: "IN_REVIEW",
        sessionState: "ACTIVE",
        resumeAvailable: true,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSession({
      cognitoIdToken: "cognito-id-token",
      sessionId: "sess_1",
    });

    expect(result).toMatchObject({
      sessionId: "sess_1",
      sessionState: "ACTIVE",
      resumeAvailable: true,
      workflowStatus: "IN_REVIEW",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kycly.test/kyclink/sess_1");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cognito-id-token");
  });

  it("propagates canonical session read failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: "KycLink session not found",
          code: "KYCLINK_SESSION_NOT_FOUND",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchKycSession({
        cognitoIdToken: "cognito-id-token",
        sessionId: "sess_1",
      }),
    ).rejects.toBeInstanceOf(KycSessionError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.kycly.test/kyclink/sess_1");
  });

  it("relaie workflowStatus et delegue le filtrage a l amont", async () => {
    // Le filtrage n'est plus fait ici : on transmet les criteres et on rend ce que l'amont
    // renvoie. Ce test verifiait autrefois un tri/filtre en memoire, volontairement supprime.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            session_id: "sess_1",
            external_id: "cust_0042",
            status: "completed",
            workflowStatus: "APPROVED",
            expires_at: null,
            completed_at: "2026-05-17T12:03:00.000Z",
            created_at: "2026-05-17T12:00:00.000Z",
            sessionState: "COMPLETED",
            resumeAvailable: false,
          },
        ],
        meta: {
          returned: 1, limit: 20, offset: 0, total: 1,
          statusCounts: { all: 1, pending: 0, processing: 0, completed: 1 },
          workflowCounts: { all: 1, PENDING: 0, IN_REVIEW: 0, ESCALATED: 0, APPROVED: 1, REJECTED: 0 },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessions({
      cognitoIdToken: "cognito-id-token",
      query: parseKycSessionsListQuery(new URLSearchParams("status=completed&workflowStatus=APPROVED")),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Les criteres partent en amont au lieu d'etre appliques ici.
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("status")).toBe("completed");
    expect(url.searchParams.get("workflowStatus")).toBe("APPROVED");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sessionId).toBe("sess_1");
    expect(result.data[0]?.workflowStatus).toBe("APPROVED");
    expect(result.meta.total).toBe(1);
    expect(result.meta.statusCounts.completed).toBe(1);
    expect(result.meta.workflowCounts.APPROVED).toBe(1);
  });

  it("ne fait plus qu UN appel amont par affichage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: {
          returned: 0, limit: 20, offset: 0, total: 0,
          statusCounts: { all: 0, pending: 0, processing: 0, completed: 0 },
          workflowCounts: { all: 0, PENDING: 0, IN_REVIEW: 0, ESCALATED: 0, APPROVED: 0, REJECTED: 0 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchKycSessions({
      cognitoIdToken: "t",
      query: parseKycSessionsListQuery(new URLSearchParams("q=kane&period=30d")),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("q")).toBe("kane");
    expect(url.searchParams.get("createdFrom")).toBeTruthy();
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("renvoie les compteurs de l amont sans les recalculer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: {
          returned: 0, limit: 20, offset: 0, total: 47,
          statusCounts: { all: 47, pending: 3, processing: 5, completed: 39 },
          workflowCounts: { all: 47, PENDING: 3, IN_REVIEW: 2, ESCALATED: 1, APPROVED: 38, REJECTED: 3 },
        },
      }),
    }));

    const result = await fetchKycSessions({
      cognitoIdToken: "t",
      query: parseKycSessionsListQuery(new URLSearchParams()),
    });

    expect(result.meta.total).toBe(47);
    expect(result.meta.statusCounts.completed).toBe(39);
  });

  it("borne q a 120 caracteres", () => {
    expect(() => parseKycSessionsListQuery(new URLSearchParams(`q=${"a".repeat(121)}`))).toThrow();
  });

  it("respecte l ordre de l amont sans le retrier", async () => {
    // Le tri et le decoupage vivaient ici ; ils sont desormais faits par l'amont, qui a la base.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            session_id: "sess_new", external_id: "cust_0041", status: "pending",
            expires_at: null, completed_at: null, created_at: "2026-05-17T12:10:00.000Z",
            workflowStatus: null, sessionState: "COMPLETED", resumeAvailable: false,
          },
          {
            session_id: "sess_mid", external_id: "cust_0042", status: "pending",
            expires_at: null, completed_at: null, created_at: "2026-05-17T12:05:00.000Z",
            workflowStatus: null, sessionState: "COMPLETED", resumeAvailable: false,
          },
        ],
        meta: {
            returned: 2, limit: 20, offset: 0, total: 2,
            statusCounts: { all: 2, pending: 2, processing: 0, completed: 0 },
            workflowCounts: { all: 2, PENDING: 0, IN_REVIEW: 0, ESCALATED: 0, APPROVED: 0, REJECTED: 0 },
          },
      }),
    }));

    const result = await fetchKycSessions({
      cognitoIdToken: "cognito-id-token",
      query: parseKycSessionsListQuery(new URLSearchParams("limit=2")),
    });

    expect(result.data.map((item) => item.sessionId)).toEqual(["sess_new", "sess_mid"]);
    expect(result.meta.total).toBe(2);
  });

  it("relaie sessionState et resumeAvailable sans les recalculer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            session_id: "sess_1",
            external_id: "cust_0042",
            status: "processing",
            workflowStatus: "PENDING",
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            completed_at: null,
            created_at: "2026-05-17T12:00:00.000Z",
            sessionState: "SUBMITTED",
            resumeAvailable: false,
          },
        ],
        meta: {
          returned: 1, limit: 20, offset: 0, total: 1,
          statusCounts: { all: 1, pending: 0, processing: 0, completed: 1 },
          workflowCounts: { all: 1, PENDING: 1, IN_REVIEW: 0, ESCALATED: 0, APPROVED: 0, REJECTED: 0 },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKycSessions({
      cognitoIdToken: "cognito-id-token",
      query: parseKycSessionsListQuery(new URLSearchParams()),
    });

    // L'etat vient de partner-node : aucune formule locale ne doit le redériver.
    expect(result.data[0]?.sessionState).toBe("SUBMITTED");
    expect(result.data[0]?.resumeAvailable).toBe(false);
    expect(result.data[0]).not.toHaveProperty("completed");
  });

  it("rejette un sessionState inconnu plutot que de le laisser passer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            session_id: "sess_1",
            external_id: null,
            status: "pending",
            workflowStatus: null,
            expires_at: null,
            completed_at: null,
            created_at: "2026-05-17T12:00:00.000Z",
            sessionState: "MYSTERE",
            resumeAvailable: true,
          },
        ],
        meta: {
          returned: 1, limit: 20, offset: 0, total: 1,
          statusCounts: { all: 1, pending: 0, processing: 0, completed: 1 },
          workflowCounts: { all: 1, PENDING: 1, IN_REVIEW: 0, ESCALATED: 0, APPROVED: 0, REJECTED: 0 },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchKycSessions({
        cognitoIdToken: "cognito-id-token",
        query: parseKycSessionsListQuery(new URLSearchParams()),
      }),
    ).rejects.toThrow();
  });
});

describe("fetchKycVerificationDetail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("récupère le détail vérif, avec Bearer + en-têtes CF", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ocrFront: { firstName: "Ada" }, ocrBack: {},
        faceSimilarity: 0.98, imageSides: ["recto"],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchKycVerificationDetail({ cognitoIdToken: "tok", sessionId: "sess-1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kycly.test/kyclink/sess-1/verification-detail");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["CF-Access-Client-Id"]).toBe("test-cf-id.access");
    expect(detail.faceSimilarity).toBe(0.98);
    expect(detail.imageSides).toEqual(["recto"]);
  });

  it("propage une erreur upstream en KycSessionError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ message: "not found", code: "NOT_FOUND" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchKycVerificationDetail({ cognitoIdToken: "tok", sessionId: "sess-x" }),
    ).rejects.toBeInstanceOf(KycSessionError);
  });
});

describe("fetchKycVerificationImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("récupère les octets d'une image + content-type", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => bytes,
    });
    vi.stubGlobal("fetch", fetchMock);

    const img = await fetchKycVerificationImage({ cognitoIdToken: "tok", sessionId: "sess-1", side: "recto" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kycly.test/kyclink/sess-1/verification-detail/images/recto");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(img.contentType).toBe("image/jpeg");
    expect(new Uint8Array(img.body)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("propage un échec image en KycSessionError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchKycVerificationImage({ cognitoIdToken: "tok", sessionId: "sess-1", side: "recto" }),
    ).rejects.toBeInstanceOf(KycSessionError);
  });
});