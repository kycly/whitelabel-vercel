export type FailurePresentation = {
  message: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export type AppErrorAction = "inline" | "logout" | "redirect-access-denied" | "redirect-failure";
export type AppErrorCategory = "auth" | "authorization" | "business" | "transient" | "unexpected";

export type AppErrorPayload = {
  message?: string;
  code?: string;
};

export class AppError extends Error {
  status: number;
  code: string;
  action: AppErrorAction;
  category: AppErrorCategory;
  sessionId?: string;
  failureCode?: string;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    action: AppErrorAction;
    category: AppErrorCategory;
    sessionId?: string;
    failureCode?: string;
  }) {
    super(params.message);
    this.name = "AppError";
    this.status = params.status;
    this.code = params.code;
    this.action = params.action;
    this.category = params.category;
    this.sessionId = params.sessionId;
    this.failureCode = params.failureCode;
  }
}

function defaultMessageForCode(code?: string): string {
  switch (code) {
    case "INVALID_COGNITO_SESSION":
      return "La session Cognito n'a pas pu etre validee. Reconnectez-vous.";
    case "ACCESS_DENIED":
      return "Cet acces demo n'est pas autorise pour ce compte.";
    case "SESSION_EXPIRED":
      return "Cette session n'est plus reprenable. Relancez une verification depuis l'historique ou le formulaire.";
    case "SESSION_NOT_FOUND":
    case "KYCLINK_SESSION_NOT_FOUND":
      return "Cette session est introuvable ou n'est pas accessible pour ce compte.";
    case "SESSIONS_FETCH_FAILED":
      return "L'historique des verifications est temporairement indisponible.";
    case "SESSION_RESULT_FETCH_FAILED":
      return "Le resultat de verification est temporairement indisponible.";
    case "SESSION_FETCH_FAILED":
    case "KYCLINK_SESSION_FETCH_FAILED":
      return "La reprise de session est temporairement indisponible.";
    case "SESSION_PREPARE_FAILED":
      return "La creation de session a echoue. Verifiez le contexte puis recommencez.";
    case "UNEXPECTED_ERROR":
      return "Une erreur inattendue a interrompu le parcours.";
    default:
      return "Le parcours a rencontre une erreur recuperable.";
  }
}

export function getAppErrorMessage(code?: string, message?: string): string {
  const fallback = defaultMessageForCode(undefined);
  const resolvedDefault = defaultMessageForCode(code);

  if (code && resolvedDefault !== fallback) {
    return resolvedDefault;
  }

  return message?.trim() || resolvedDefault;
}

export function buildFailureHref(params: { code?: string; message?: string; sessionId?: string }): string {
  const query = new URLSearchParams();

  if (params.sessionId) {
    query.set("sessionId", params.sessionId);
  }

  if (params.code) {
    query.set("code", params.code);
  }

  if (params.message) {
    query.set("message", params.message);
  }

  return `/failure?${query.toString()}`;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function resolveProtectedAppError(params: {
  status: number;
  code?: string;
  message?: string;
  defaultMessage: string;
  defaultFailureCode: string;
  failureCodeMap?: Record<string, string>;
  sessionId?: string;
}): AppError {
  const resolvedCode = params.code ?? params.defaultFailureCode;

  if (params.status === 401 || resolvedCode === "UNAUTHORIZED") {
    return new AppError({
      message: getAppErrorMessage("UNAUTHORIZED", params.message ?? params.defaultMessage),
      status: params.status,
      code: "UNAUTHORIZED",
      action: "logout",
      category: "auth",
      sessionId: params.sessionId,
    });
  }

  if (resolvedCode === "ACCESS_DENIED") {
    return new AppError({
      message: getAppErrorMessage("ACCESS_DENIED", params.message ?? params.defaultMessage),
      status: params.status,
      code: "ACCESS_DENIED",
      action: "redirect-access-denied",
      category: "authorization",
      sessionId: params.sessionId,
    });
  }

  const failureCode = params.failureCodeMap?.[resolvedCode] ?? params.defaultFailureCode;

  return new AppError({
    message: getAppErrorMessage(failureCode, params.message ?? params.defaultMessage),
    status: params.status,
    code: resolvedCode,
    action: "redirect-failure",
    category: params.status >= 500 ? "transient" : "business",
    sessionId: params.sessionId,
    failureCode,
  });
}

export function resolveInlineAppError(params: {
  status: number;
  code?: string;
  message?: string;
  defaultMessage: string;
}): AppError {
  const resolvedCode = params.code ?? "UNEXPECTED_ERROR";

  return new AppError({
    message: getAppErrorMessage(resolvedCode, params.message ?? params.defaultMessage),
    status: params.status,
    code: resolvedCode,
    action: "inline",
    category: params.status === 401 ? "auth" : "unexpected",
  });
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
    case "SESSIONS_FETCH_FAILED":
    case "SESSION_RESULT_FETCH_FAILED":
      return {
        message: resolvedMessage,
        primaryHref: "/sessions",
        primaryLabel: "Mes vérifications",
        secondaryHref: "/welcome",
        secondaryLabel: "Accueil",
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
        primaryHref: "/welcome",
        primaryLabel: "Accueil",
        secondaryHref: "/welcome",
        secondaryLabel: "Accueil",
      };
  }
}