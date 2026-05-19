export type FailurePresentation = {
  message: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

function defaultMessageForCode(code?: string): string {
  switch (code) {
    case "SESSION_EXPIRED":
      return "Cette session n'est plus reprenable. Relancez une verification depuis l'historique ou le formulaire.";
    case "SESSION_NOT_FOUND":
    case "KYCLINK_SESSION_NOT_FOUND":
      return "Cette session est introuvable ou n'est pas accessible pour ce compte.";
    case "SESSION_FETCH_FAILED":
    case "KYCLINK_SESSION_FETCH_FAILED":
      return "La reprise de session est temporairement indisponible.";
    case "SESSION_PREPARE_FAILED":
      return "La creation de session a echoue. Verifiez le contexte puis recommencez.";
    default:
      return "Le parcours a rencontre une erreur recuperable.";
  }
}

export function getAppErrorMessage(code?: string, message?: string): string {
  return message?.trim() || defaultMessageForCode(code);
}

export function getFailurePresentation(code?: string, message?: string): FailurePresentation {
  const resolvedMessage = getAppErrorMessage(code, message);

  switch (code) {
    case "SESSION_EXPIRED":
      return {
        message: resolvedMessage,
        primaryHref: "/verify",
        primaryLabel: "Nouvelle vérification",
        secondaryHref: "/sessions",
        secondaryLabel: "Mes vérifications",
      };
    case "SESSION_NOT_FOUND":
    case "KYCLINK_SESSION_NOT_FOUND":
    case "SESSION_FETCH_FAILED":
    case "KYCLINK_SESSION_FETCH_FAILED":
      return {
        message: resolvedMessage,
        primaryHref: "/sessions",
        primaryLabel: "Mes vérifications",
        secondaryHref: "/verify",
        secondaryLabel: "Nouvelle vérification",
      };
    case "SESSION_PREPARE_FAILED":
      return {
        message: resolvedMessage,
        primaryHref: "/verify",
        primaryLabel: "Reessayer",
        secondaryHref: "/welcome",
        secondaryLabel: "Accueil",
      };
    default:
      return {
        message: resolvedMessage,
        primaryHref: "/verify",
        primaryLabel: "Reessayer",
        secondaryHref: "/welcome",
        secondaryLabel: "Accueil",
      };
  }
}