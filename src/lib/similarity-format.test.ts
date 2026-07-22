import { describe, expect, it } from "vitest";
import { formatSimilarityPercent } from "./similarity-format";

describe("formatSimilarityPercent", () => {
  it("convertit un ratio 0-1 en pourcentage entier", () => {
    expect(formatSimilarityPercent(0.97)).toBe(97);
  });

  it("renvoie null si aucune donnée", () => {
    expect(formatSimilarityPercent(null)).toBeNull();
  });

  it("arrondit au plus proche", () => {
    expect(formatSimilarityPercent(0.965)).toBe(97);
    expect(formatSimilarityPercent(0.964)).toBe(96);
  });
});
