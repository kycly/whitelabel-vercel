import { describe, expect, it } from "vitest";
import { withKyclinkOriginDebug } from "@/lib/kyclink-url";

describe("withKyclinkOriginDebug", () => {
  it("ajoute debug_origin=1 a une URL KycLink sans query existante", () => {
    expect(withKyclinkOriginDebug("https://link.kycly.io/s/sess_1")).toBe(
      "https://link.kycly.io/s/sess_1?debug_origin=1",
    );
  });

  it("preserve les query params existants et force debug_origin=1", () => {
    expect(
      withKyclinkOriginDebug(
        "https://link.kycly.io/s/sess_1?cs=123&debug_origin=0",
      ),
    ).toBe("https://link.kycly.io/s/sess_1?cs=123&debug_origin=1");
  });
});