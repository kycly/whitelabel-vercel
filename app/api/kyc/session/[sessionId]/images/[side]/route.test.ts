import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth/session", () => ({ readSession: vi.fn(), clearSessionCookie: vi.fn() }));
vi.mock("@/server/kyclink", () => ({
  fetchKycVerificationImage: vi.fn(),
  KycSessionError: class KycSessionError extends Error {
    statusCode = 404;
    code = "NOT_FOUND";
  },
}));

import { GET } from "./route";
import { readSession } from "@/auth/session";
import { fetchKycVerificationImage } from "@/server/kyclink";

const ctx = (id: string, side: string) => ({ params: Promise.resolve({ sessionId: id, side }) });

describe("GET /api/kyc/session/:id/images/:side", () => {
  afterEach(() => vi.clearAllMocks());

  it("403 si pas d'accès démo", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ canAccess: false, demoAccountId: null, cognitoIdToken: "t" });
    const res = await GET(new Request("http://x"), ctx("vrf-1", "recto"));
    expect(res.status).toBe(403);
  });

  it("renvoie l'image avec le bon content-type", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ canAccess: true, demoAccountId: "demo", cognitoIdToken: "t" });
    (fetchKycVerificationImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ body: new Uint8Array([1, 2, 3]).buffer, contentType: "image/jpeg" });
    const res = await GET(new Request("http://x"), ctx("vrf-1", "recto"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchKycVerificationImage).toHaveBeenCalledWith({ cognitoIdToken: "t", sessionId: "vrf-1", side: "recto" });
  });

  it("refuse de servir un content-type non-image renvoyé par l'amont (défense XSS)", async () => {
    (readSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ canAccess: true, demoAccountId: "demo", cognitoIdToken: "t" });
    (fetchKycVerificationImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      body: new TextEncoder().encode("<script>alert(1)</script>").buffer,
      contentType: "text/html",
    });
    const res = await GET(new Request("http://x"), ctx("vrf-1", "recto"));
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).not.toBe("text/html");
  });
});
