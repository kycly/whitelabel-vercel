import { describe, expect, it } from "vitest";
import { groupImageSides } from "./image-sides";

describe("groupImageSides", () => {
  it("sépare portrait/liveness (evidence) de recto/verso (documentScans)", () => {
    expect(groupImageSides(["portrait", "liveness", "recto", "verso"])).toEqual({
      evidence: ["portrait", "liveness"],
      documentScans: ["recto", "verso"],
    });
  });

  it("place un side inconnu dans documentScans par défaut", () => {
    expect(groupImageSides(["recto", "autre"])).toEqual({
      evidence: [],
      documentScans: ["recto", "autre"],
    });
  });

  it("gère un tableau vide", () => {
    expect(groupImageSides([])).toEqual({ evidence: [], documentScans: [] });
  });
});
