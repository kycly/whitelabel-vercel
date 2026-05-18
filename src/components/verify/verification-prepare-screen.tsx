"use client";

import { useEffect } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";
import { saveActiveVerificationSession } from "@/lib/active-verification-session";
import { clearVerificationDraft, readVerificationDraft } from "@/lib/verification-draft";

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text();

  if (!raw) {
    return "Creation impossible.";
  }

  try {
    const parsed = JSON.parse(raw) as { message?: string };
    return parsed.message ?? "Creation impossible.";
  } catch {
    return raw;
  }
}

export function VerificationPrepareScreen() {
  useEffect(() => {
    let cancelled = false;

    const createSession = async () => {
      const draft = readVerificationDraft();

      if (!draft) {
        window.location.replace("/verify");
        return;
      }

      try {
        const response = await fetch("/api/kyc/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const createdSession = (await response.json()) as {
          sessionId: string;
          kyclinkUrl: string;
          expiresAt: string;
        };

        if (cancelled) {
          return;
        }

        saveActiveVerificationSession(createdSession);
        clearVerificationDraft();
        window.location.replace(`/verify/session?sessionId=${encodeURIComponent(createdSession.sessionId)}`);
      } catch (reason) {
        if (cancelled) {
          return;
        }

        const message = reason instanceof Error ? reason.message : "Creation impossible.";
        const query = new URLSearchParams({
          code: "SESSION_PREPARE_FAILED",
          message,
        });

        window.location.replace(`/failure?${query.toString()}`);
      }
    };

    void createSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProtectedScreenShell backHref="/verify" title="Session" maxWidthClassName="max-w-2xl" panelClassName="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-light)]">
          <LoaderCircle className="h-9 w-9 animate-spin text-brand" />
          <div className="absolute -right-1 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-4 w-4 text-green-500" aria-hidden="true" />
          </div>
        </div>
        <div className={surfaceInfoCardClassName}>
          Préparation de votre session
        </div>
    </ProtectedScreenShell>
  );
}