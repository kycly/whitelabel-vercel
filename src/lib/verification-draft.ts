import type { SessionContextInput } from "@/lib/verification";

const VERIFICATION_DRAFT_KEY = "kycly.verificationDraft";

export function saveVerificationDraft(input: SessionContextInput): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(VERIFICATION_DRAFT_KEY, JSON.stringify(input));
}

export function readVerificationDraft(): SessionContextInput | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(VERIFICATION_DRAFT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionContextInput;
  } catch {
    return null;
  }
}

export function clearVerificationDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(VERIFICATION_DRAFT_KEY);
}