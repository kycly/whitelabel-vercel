export function computeConfidenceTicks(percent: number, totalTicks: number): number {
  const raw = Math.round((percent / 100) * totalTicks);
  return Math.min(totalTicks, Math.max(0, raw));
}
