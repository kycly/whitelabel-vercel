import { describe, expect, it } from "vitest";
import { computeConfidenceTicks } from "./confidence-ticks";

describe("computeConfidenceTicks", () => {
  it("calcule le nombre de graduations pleines pour un pourcentage donné", () => {
    expect(computeConfidenceTicks(97, 10)).toBe(10);
    expect(computeConfidenceTicks(50, 10)).toBe(5);
    expect(computeConfidenceTicks(4, 10)).toBe(0);
  });

  it("arrondit au plus proche", () => {
    expect(computeConfidenceTicks(65, 10)).toBe(7);
    expect(computeConfidenceTicks(64, 10)).toBe(6);
  });

  it("borne le résultat entre 0 et totalTicks", () => {
    expect(computeConfidenceTicks(-5, 10)).toBe(0);
    expect(computeConfidenceTicks(150, 10)).toBe(10);
  });
});
