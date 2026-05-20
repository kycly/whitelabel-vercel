"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { redirectToLogout } from "@/auth/cognito-client";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { VerificationRunScreen } from "@/components/verify/verification-run-screen";
import { surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";

type VerificationSessionGateProps = {
  sessionId: string;
};

type CanonicalSession = {
  sessionId: string;
  kyclinkUrl: string;
  sessionState: "ACTIVE" | "COMPLETED" | "EXPIRED";
  resumeAvailable: boolean;
};

type GateState =
  | { status: "loading" }
  | { status: "ready"; kyclinkUrl: string };

function failureHref(params: { sessionId: string; code: string; message: string }): string {
  const query = new URLSearchParams({
    sessionId: params.sessionId,
    code: params.code,
    message: params.message,
  });

  return `/failure?${query.toString()}`;
}

export function VerificationSessionGate({ sessionId }: VerificationSessionGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch(`/api/kyc/session/${encodeURIComponent(sessionId)}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as
          | CanonicalSession
          | { code?: string; message?: string };

        if (!response.ok) {
          if (response.status === 401 || ("code" in payload && payload.code === "UNAUTHORIZED")) {
            redirectToLogout();
            return;
          }

          const code = payload && "code" in payload && typeof payload.code === "string"
            ? payload.code
            : "SESSION_FETCH_FAILED";
          const message = payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "La reprise de session est temporairement indisponible.";

          router.replace(
            failureHref({
              sessionId,
              code: code === "KYCLINK_SESSION_NOT_FOUND" ? "SESSION_NOT_FOUND" : "SESSION_FETCH_FAILED",
              message,
            }),
          );
          return;
        }

        const session = payload as CanonicalSession;

        if (session.sessionState === "COMPLETED") {
          router.replace(`/complete?sessionId=${encodeURIComponent(sessionId)}`);
          return;
        }

        if (session.sessionState === "EXPIRED" || !session.resumeAvailable) {
          router.replace(
            failureHref({
              sessionId,
              code: "SESSION_EXPIRED",
              message: "Cette session n'est plus reprenable. Relancez une verification depuis l'historique ou le formulaire.",
            }),
          );
          return;
        }

        setState({
          status: "ready",
          kyclinkUrl: session.kyclinkUrl,
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        router.replace(
          failureHref({
            sessionId,
            code: "UNEXPECTED_ERROR",
            message: "Une erreur inattendue a interrompu la reprise de session.",
          }),
        );
      }
    }

    void loadSession();

    return () => {
      controller.abort();
    };
  }, [router, sessionId]);

  if (state.status === "loading") {
    return (
      <ProtectedScreenShell
        backHref="/verify"
        title="Parcours"
        showBack={false}
        showLogout={false}
        maxWidthClassName="sm:max-w-5xl"
        panelClassName="flex min-h-0 flex-1 flex-col justify-center !pt-0"
      >
          <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-center">
            <div className={[surfaceInfoCardClassName, "flex items-center justify-center gap-3 rounded-3xl px-5 py-4 text-[var(--foreground)]"].join(" ")}>
              <LoaderCircle className="size-4 animate-spin text-brand" />
              Chargement du parcours sécurisé.
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Reprise de la session et vérification de l&apos;accès en cours.
            </p>
          </div>
      </ProtectedScreenShell>
    );
  }

  return <VerificationRunScreen sessionId={sessionId} kyclinkUrl={state.kyclinkUrl} />;
}