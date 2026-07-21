import { describe, expect, it } from "vitest";
import { formatOcrLabel } from "@/lib/ocr-format";

describe("lib/ocr-format", () => {
  it("humanise les clés snake_case (première lettre en majuscule seulement, comme partner-node)", () => {
    expect(formatOcrLabel("document_number")).toBe("Document number");
  });
  it("humanise les clés camelCase", () => {
    expect(formatOcrLabel("givenNames")).toBe("Given Names");
  });
  it("met la première lettre en majuscule", () => {
    expect(formatOcrLabel("surname")).toBe("Surname");
  });
});
