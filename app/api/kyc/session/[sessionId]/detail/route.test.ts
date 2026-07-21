import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/session", () => ({ readSession: vi.fn(), clearSessionCookie: vi.fn() }));
vi.mock("@/server/kyclink", () => ({
  fetchKycVerificationDetail: vi.fn(),
  KycSessionError: class KycSessionError extends Error {
    statusCode = 404;
    code = "NOT_FOUND";
  },
}));

import { GET } from "./route";
import { readSession } from "@/auth/session";
import { fetchKycVerificationDetail } from "@/server/kyclink";

const ctx = (id: string) => ({ params: Promise.resolve({ sessionId: id }) });

describe("GET /api/kyc/session/:id/detail", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 si pas de session", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(new Request("http://x"), ctx("vrf-1"));
    expect(res.status).toBe(401);
  });

  it("403 si canAccess/demoAccountId manquant", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ canAccess: false, demoAccountId: null, cognitoIdToken: "t" });
    const res = await GET(new Request("http://x"), ctx("vrf-1"));
    expect(res.status).toBe(403);
  });

  it("200 avec le détail projeté", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ canAccess: true, demoAccountId: "demo", cognitoIdToken: "t" });
    (fetchKycVerificationDetail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ocrFront: {}, ocrBack: {}, faceSimilarity: null, imageSides: [],
    });
    const res = await GET(new Request("http://x"), ctx("vrf-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ocrFront: {} });
    expect(fetchKycVerificationDetail).toHaveBeenCalledWith({ cognitoIdToken: "t", sessionId: "vrf-1" });
  });
});
