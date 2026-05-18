"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KycLink } from "@kycly/link/react";
import type { KycLinkErrorPayload } from "@kycly/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { primaryCtaClassName, surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";
import { readActiveVerificationSession, type ActiveVerificationSession } from "@/lib/active-verification-session";

type VerificationRunScreenProps = {
  sessionId: string;
};

type RunState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      session: ActiveVerificationSession;
    };

export function VerificationRunScreen({ sessionId }: VerificationRunScreenProps) {
  const router = useRouter();
  const [state, setState] = useState<RunState>({ status: "loading" });

  useEffect(() => {
    const scheduled = window.setTimeout(() => {
      const session = readActiveVerificationSession(sessionId);

      if (!session) {
        setState({
          status: "error",
          message: "Session introuvable. Recommencez la creation.",
        });
        return;
      }

      setState({
        status: "ready",
        session,
      });
    }, 0);

    return () => {
      window.clearTimeout(scheduled);
    };
  }, [sessionId]);

  function redirectToFailure(payload: KycLinkErrorPayload) {
    const query = new URLSearchParams();

    query.set("sessionId", payload.sessionId ?? sessionId);

    if (payload.code) {
      query.set("code", payload.code);
    }

    if (payload.message) {
      query.set("message", payload.message);
    } else if (payload.error) {
      query.set("message", payload.error);
    }

    router.push(`/failure?${query.toString()}`);
  }

  if (state.status === "loading") {
    return (
      <ProtectedScreenShell backHref="/verify" title="Parcours" maxWidthClassName="max-w-5xl" panelClassName="flex flex-1 flex-col justify-center space-y-4">
          <div className={[surfaceInfoCardClassName, "flex items-center gap-3"].join(" ")}>
            <LoaderCircle className="size-4 animate-spin" />
            Chargement du parcours.
          </div>
      </ProtectedScreenShell>
    );
  }

  if (state.status === "error") {
    return (
      <ProtectedScreenShell backHref="/verify" title="Parcours" maxWidthClassName="max-w-2xl" panelClassName="flex flex-1 flex-col justify-center space-y-4">
          <div className={surfaceInfoCardClassName}>{state.message}</div>
          <Link
            href="/verify"
            className={primaryCtaClassName}
          >
            Revenir au formulaire
          </Link>
      </ProtectedScreenShell>
    );
  }

  const { session } = state;

  return (
    <ProtectedScreenShell backHref="/verify" title="Parcours" maxWidthClassName="max-w-5xl" panelClassName="flex flex-1 flex-col pt-2">
        <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
          <KycLink
            kyclinkUrl={session.kyclinkUrl}
            className="min-h-full w-full border-0 bg-white"
            height={736}
            onComplete={(payload) => {
              router.push(`/complete?sessionId=${encodeURIComponent(payload.sessionId)}`);
            }}
            onError={(payload) => {
              redirectToFailure(payload);
            }}
          />
        </div>
    </ProtectedScreenShell>
  );
}