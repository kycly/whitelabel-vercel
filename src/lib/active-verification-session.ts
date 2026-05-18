export type ActiveVerificationSession = {
  sessionId: string;
  kyclinkUrl: string;
  expiresAt: string;
};

const ACTIVE_VERIFICATION_SESSION_KEY = "kycly.activeVerificationSession";

export function saveActiveVerificationSession(session: ActiveVerificationSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ACTIVE_VERIFICATION_SESSION_KEY, JSON.stringify(session));
}

export function readActiveVerificationSession(sessionId?: string): ActiveVerificationSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(ACTIVE_VERIFICATION_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveVerificationSession>;

    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.kyclinkUrl !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }

    if (sessionId && parsed.sessionId !== sessionId) {
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      kyclinkUrl: parsed.kyclinkUrl,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function clearActiveVerificationSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ACTIVE_VERIFICATION_SESSION_KEY);
}