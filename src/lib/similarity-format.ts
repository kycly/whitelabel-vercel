export function formatSimilarityPercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.round(value * 100);
}
