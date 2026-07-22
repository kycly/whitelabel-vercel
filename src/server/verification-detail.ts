// Upstream = GET /kyclink/:sessionId/verification-detail (partner-node) : réponse déjà propre par
// construction. Cette fonction ne fait qu'une validation défensive de forme.
export type VerificationDetail = {
  ocrFront: Record<string, unknown>;
  ocrBack: Record<string, unknown>;
  faceSimilarity: number | null;
  validationScore: number | null;
  imageSides: string[];
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function projectVerificationDetail(raw: unknown): VerificationDetail {
  const src = asRecord(raw);
  return {
    ocrFront: asRecord(src.ocrFront),
    ocrBack: asRecord(src.ocrBack),
    faceSimilarity: asNumber(src.faceSimilarity),
    validationScore: asNumber(src.validationScore),
    imageSides: asStringArray(src.imageSides),
  };
}
