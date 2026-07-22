import { describe, expect, it } from "vitest";
import { projectVerificationDetail } from "@/server/verification-detail";

describe("server/verification-detail projection", () => {
  it("conserve les champs métier", () => {
    const d = projectVerificationDetail({
      ocrFront: { firstName: "Ada", document_number: "X123" },
      ocrBack: { address: "12 rue Demo" },
      faceSimilarity: 0.98,
      validationScore: 0.95,
      imageSides: ["recto", "portrait"],
    });
    expect(d).toEqual({
      ocrFront: { firstName: "Ada", document_number: "X123" },
      ocrBack: { address: "12 rue Demo" },
      faceSimilarity: 0.98,
      validationScore: 0.95,
      imageSides: ["recto", "portrait"],
    });
  });
  it("tolère les champs absents (upstream incomplet)", () => {
    const d = projectVerificationDetail({});
    expect(d).toEqual({ ocrFront: {}, ocrBack: {}, faceSimilarity: null, validationScore: null, imageSides: [] });
  });
  it("ignore toute clé inattendue de l'upstream", () => {
    const d = projectVerificationDetail({
      ocrFront: {}, ocrBack: {}, faceSimilarity: null, imageSides: [],
      s3_keys: { recto: "s3://x" }, raw_payload: { huge: true },
    }) as Record<string, unknown>;
    expect("s3_keys" in d).toBe(false);
    expect("raw_payload" in d).toBe(false);
  });
});
