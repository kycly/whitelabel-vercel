"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { handleAppError, requestProtectedJson } from "@/lib/app-client";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { VerificationRunScreen } from "@/components/verify/verification-run-screen";
import { SurfaceCard } from "@kycly/ui";

type VerificationSessionGateProps = {
  sessionId: string;
};

type CanonicalSession = {
  sessionId: string;
  kyclinkUrl: string;
  status: "pending" | "processing" | "completed";
  sessionState: "ACTIVE" | "COMPLETED" | "EXPIRED";
  resumeAvailable: boolean;
};

type GateState =
  | { status: "loading" }
  | { status: "ready"; kyclinkUrl: string };

const RESUME_STATUS_POLL_MAX_ATTEMPTS = 3;
const RESUME_STATUS_POLL_INTERVAL_MS = 1500;

function failureHref(params: { sessionId: string; code: string; message: string }): string {
  const query = new URLSearchParams({
    sessionId: params.sessionId,
    code: params.code,
    message: params.message,
  });

  return `/failure?${query.toString()}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function VerificationSessionGate({ sessionId }: VerificationSessionGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadSession() {
      try {
        for (let attempt = 1; attempt <= RESUME_STATUS_POLL_MAX_ATTEMPTS; attempt += 1) {
          const session = await requestProtectedJson<CanonicalSession>(`/api/kyc/session/${encodeURIComponent(sessionId)}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }, {
            defaultMessage: "La reprise de session est temporairement indisponible.",
            defaultFailureCode: "SESSION_FETCH_FAILED",
            failureCodeMap: {
              KYCLINK_SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
            },
            sessionId,
          });

          if (cancelled) {
            return;
          }

          // La verif peut deja etre terminee (decision rendue) sans que la liste
          // des sessions le sache encore : on reaffiche le resultat plutot que de
          // rouvrir un widget kyclink sur une session deja soumise.
          if (session.status === "completed" || session.sessionState === "COMPLETED") {
            router.replace(`/sessions/${encodeURIComponent(sessionId)}`);
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

          if (attempt < RESUME_STATUS_POLL_MAX_ATTEMPTS) {
            await wait(RESUME_STATUS_POLL_INTERVAL_MS);
            continue;
          }

          setState({
            status: "ready",
            kyclinkUrl: session.kyclinkUrl,
          });
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        if (handleAppError(error)) {
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
      cancelled = true;
      controller.abort();
    };
  }, [router, sessionId]);

  if (state.status === "loading") {
    return (
      <ProtectedScreenShell
        backHref="/verify"
        fullViewport
        showBack={false}
        showHeader={false}
        showLogout={false}
        maxWidthClassName="w-full"
        panelClassName="flex min-h-0 flex-1 flex-col justify-center px-6 text-center"
      >
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3 text-center">
            <SurfaceCard variant="raised" className="flex items-center justify-center gap-3 px-5 py-4 text-[var(--foreground)]">
              <LoaderCircle className="size-4 animate-spin text-brand" />
              Chargement du parcours sécurisé.
            </SurfaceCard>
            <p className="text-sm text-[var(--muted-foreground)]">
              Reprise de la session et vérification de l&apos;accès en cours.
            </p>
          </div>
      </ProtectedScreenShell>
    );
  }

  return <VerificationRunScreen sessionId={sessionId} kyclinkUrl={state.kyclinkUrl} />;
}