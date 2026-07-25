// Cadence de poll unique de l'écran de résultat.
//
// Premier appel immédiat, sans délai initial : l'écran est aussi ouvert sur des vérifications
// déjà terminées depuis l'historique, où attendre n'apporte rien.
//
// Le bornage n'est acceptable que parce que `GET /api/kyc/session/:id` réconcilie l'amont côté
// partner-node à chaque appel : le poll fait converger le cycle de vie au lieu d'attendre
// passivement un webhook. Sur une lecture purement locale, aucun nombre de tentatives ne suffirait.
const BASE_DELAY_MS = 5_000;
const STEP_DELAY_MS = 2_500;
const MAX_DELAY_MS = 20_000;

export const MAX_POLL_ATTEMPTS = 12;

export function nextPollDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS + Math.max(attempt - 1, 0) * STEP_DELAY_MS, MAX_DELAY_MS);
}

export function pollCountdownMessage(countdownSeconds: number, attemptCount: number): string {
  const remaining = Math.max(MAX_POLL_ATTEMPTS - attemptCount, 0);
  const plural = remaining > 1 ? "s" : "";
  return `Prochaine vérification dans ${countdownSeconds}s (${remaining} tentative${plural} restante${plural}).`;
}

export function reachedPollingLimit(attemptCount: number): boolean {
  return attemptCount >= MAX_POLL_ATTEMPTS;
}
