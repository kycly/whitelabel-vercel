// Type unique du cycle de vie d'une session côté front. La valeur est calculée par partner-node
// (`resolveKyclinkSessionState`) et n'est JAMAIS recalculée ici : c'est la contrepartie front de
// l'autorité unique. Toute formule locale de « soumise / reprenable / terminée » est un régression.
export type SessionState = "ACTIVE" | "SUBMITTED" | "COMPLETED" | "EXPIRED";

export type VerificationView =
  | "loading"
  | "resumable"
  | "awaiting-decision"
  | "awaiting-detail"
  | "complete"
  | "expired";

// Le rendu dépend UNIQUEMENT de l'état de session et de la présence du détail — jamais de la
// provenance (soumission fraîche, « Voir le résultat », reprise, URL directe). C'est ce qui garantit
// que l'écran d'attente est le même partout.
export function selectVerificationView(input: {
  sessionState: SessionState | null;
  hasDetail: boolean;
}): VerificationView {
  switch (input.sessionState) {
    case null:
      return "loading";
    case "ACTIVE":
      return "resumable";
    case "SUBMITTED":
      return "awaiting-decision";
    case "EXPIRED":
      return "expired";
    case "COMPLETED":
      return input.hasDetail ? "complete" : "awaiting-detail";
  }
}

export function shouldPoll(view: VerificationView): boolean {
  return view === "awaiting-decision" || view === "awaiting-detail";
}
