"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";
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
    <PageShell maxWidthClassName="max-w-4xl">
      <SurfacePanel className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">SESSION_PREPARE</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Preparation</h1>
          <p className="text-sm text-slate-600">Creation securisee de votre session.</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
          <LoaderCircle className="size-4 animate-spin" />
          Creation de la session en cours.
        </div>
      </SurfacePanel>
    </PageShell>
  );
}