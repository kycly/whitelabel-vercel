"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KycLink } from "@kycly/link/react";
import type { KycLinkErrorPayload } from "@kycly/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";
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
      <PageShell maxWidthClassName="max-w-5xl">
        <SurfacePanel className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">KYC_LINK</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Verification en cours</h1>
              <p className="text-sm text-slate-600">Chargement de la session.</p>
            </div>

            <LogoutButton className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" label="Deconnexion" />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <LoaderCircle className="size-4 animate-spin" />
            Chargement du parcours.
          </div>
        </SurfacePanel>
      </PageShell>
    );
  }

  if (state.status === "error") {
    return (
      <PageShell maxWidthClassName="max-w-4xl">
        <SurfacePanel className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">KYC_LINK</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Session indisponible</h1>
            <p className="text-sm text-slate-600">{state.message}</p>
          </div>

          <Link
            href="/verify"
            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700"
          >
            Revenir au formulaire
          </Link>
        </SurfacePanel>
      </PageShell>
    );
  }

  const { session } = state;

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <SurfacePanel className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">KYC_LINK</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Verification en cours</h1>
            <p className="text-sm text-slate-600">Autorisez la camera si necessaire.</p>
          </div>

          <LogoutButton className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" label="Deconnexion" />
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
          <KycLink
            kyclinkUrl={session.kyclinkUrl}
            className="w-full border-0 bg-white"
            height={780}
            onComplete={(payload) => {
              router.push(`/complete?sessionId=${encodeURIComponent(payload.sessionId)}`);
            }}
            onError={(payload) => {
              redirectToFailure(payload);
            }}
          />
        </div>
      </SurfacePanel>
    </PageShell>
  );
}