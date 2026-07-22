const EVIDENCE_SIDES = new Set(["portrait", "liveness"]);

export function groupImageSides(sides: string[]): { evidence: string[]; documentScans: string[] } {
  const evidence = sides.filter((side) => EVIDENCE_SIDES.has(side));
  const documentScans = sides.filter((side) => !EVIDENCE_SIDES.has(side));
  return { evidence, documentScans };
}
