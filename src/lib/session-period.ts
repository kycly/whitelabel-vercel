export type SessionPeriod = "7d" | "30d" | "all";

const PERIOD_DAYS: Record<Exclude<SessionPeriod, "all">, number> = { "7d": 7, "30d": 30 };

/**
 * Traduit le vocabulaire d'interface (« 30 derniers jours ») en borne absolue, avant l'appel
 * amont. partner-node reste ignorant de ce vocabulaire : il ne connait que `createdFrom`.
 */
export function resolveCreatedFrom(period: SessionPeriod, now: Date): string | undefined {
  if (period === "all") return undefined;
  const from = new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
  return from.toISOString();
}
