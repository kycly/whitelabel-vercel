"use client";

import { useEffect } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";
import { errorMessage } from "@/lib/app-error";
import { handleAppError, requestProtectedJson } from "@/lib/app-client";
import { clearVerificationDraft, readVerificationDraft } from "@/lib/verification-draft";

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
        const createdSession = await requestProtectedJson<{ sessionId: string }>("/api/kyc/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }, {
          defaultMessage: "Creation impossible.",
          defaultFailureCode: "SESSION_PREPARE_FAILED",
        });

        if (cancelled) {
          return;
        }

        clearVerificationDraft();
        window.location.replace(`/verify/session?sessionId=${encodeURIComponent(createdSession.sessionId)}`);
      } catch (reason) {
        if (cancelled) {
          return;
        }

        if (handleAppError(reason)) {
          return;
        }

        const message = errorMessage(reason, "Creation impossible.");
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
    <ProtectedScreenShell
      backHref="/verify"
      preferBackHref
      title="Session"
      showLogout={false}
      maxWidthClassName="sm:max-w-[430px]"
      panelClassName="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 !pt-0 text-center"
    >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-light)]">
          <LoaderCircle className="h-7 w-7 animate-spin text-brand" />
          <div className="absolute -right-1 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-4 w-4 text-green-500" aria-hidden="true" />
          </div>
        </div>
        <div className={[surfaceInfoCardClassName, "w-full max-w-sm rounded-3xl px-5 py-4"].join(" ")}>
          <p className="font-medium text-[var(--foreground)]">Préparation de votre session</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Création de l&apos;accès KYC et ouverture du parcours en cours.</p>
        </div>
    </ProtectedScreenShell>
  );
}