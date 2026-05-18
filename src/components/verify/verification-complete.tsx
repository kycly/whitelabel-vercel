"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, LoaderCircle, RefreshCcw } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

type KycSessionResult = {
  sessionId: string;
  externalId?: string;
  status: "pending" | "processing" | "completed";
  completed: boolean;
  completedAt: string | null;
  validationStatus: "APPROVED" | "REJECTED" | "REVIEW" | null;
};

type ResultState = {
  data: KycSessionResult | null;
  error: string | null;
  isPolling: boolean;
  attemptCount: number;
  countdownSeconds: number;
  attemptHistory: PollAttempt[];
};

type PollAttempt = {
  attempt: number;
  checkedAt: string;
  outcome: "success" | "error";
  status: KycSessionResult["status"] | null;
  completed: boolean | null;
  validationStatus: KycSessionResult["validationStatus"];
  nextPollInSeconds: number | null;
  message: string;
};

const FIRST_POLL_DELAY_SECONDS = 10;
const SUBSEQUENT_POLL_BASE_DELAY_MS = 5_000;
const SUBSEQUENT_POLL_STEP_DELAY_MS = 2_500;
const SUBSEQUENT_POLL_MAX_DELAY_MS = 20_000;
const MAX_POLL_ATTEMPTS = 12;

function nextPollDelayMs(attempt: number): number {
  return Math.min(
    SUBSEQUENT_POLL_BASE_DELAY_MS + Math.max(attempt - 1, 0) * SUBSEQUENT_POLL_STEP_DELAY_MS,
    SUBSEQUENT_POLL_MAX_DELAY_MS,
  );
}

function statusLabel(status: KycSessionResult["status"] | null): string {
  if (status === "completed") {
    return "Resultat backend confirme";
  }

  if (status === "processing") {
    return "Analyse backend en cours";
  }

  return "Attente du premier resultat backend";
}

function validationStatusLabel(validationStatus: KycSessionResult["validationStatus"]): string {
  if (validationStatus === "APPROVED") {
    return "Approuve";
  }

  if (validationStatus === "REJECTED") {
    return "Rejete";
  }

  if (validationStatus === "REVIEW") {
    return "Revue manuelle";
  }

  return "Non disponible";
}

function decisionTitle(validationStatus: KycSessionResult["validationStatus"]): string {
  if (validationStatus === "APPROVED") {
    return "Decision favorable confirmee";
  }

  if (validationStatus === "REJECTED") {
    return "Decision de rejet confirmee";
  }

  if (validationStatus === "REVIEW") {
    return "Verification basculee en revue manuelle";
  }

  return "Decision backend encore en attente";
}

function decisionTone(validationStatus: KycSessionResult["validationStatus"]): string {
  if (validationStatus === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (validationStatus === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (validationStatus === "REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function pollingMessage(countdownSeconds: number, attemptCount: number): string {
  const nextAttempt = Math.min(attemptCount + 1, MAX_POLL_ATTEMPTS);

  if (attemptCount === 0) {
    return `Le premier appel backend partira dans ${countdownSeconds}s minimum.`;
  }

  return `Le poll ${nextAttempt}/${MAX_POLL_ATTEMPTS} partira dans ${countdownSeconds}s.`;
}

export function VerificationComplete({ sessionId }: { sessionId: string }) {
  const [pollGeneration, setPollGeneration] = useState(0);
  const [state, setState] = useState<ResultState>({
    data: null,
    error: null,
    isPolling: false,
    attemptCount: 0,
    countdownSeconds: FIRST_POLL_DELAY_SECONDS,
    attemptHistory: [],
  });

  useEffect(() => {
    if (state.countdownSeconds <= 0 || state.data?.completed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        countdownSeconds: Math.max(current.countdownSeconds - 1, 0),
      }));
    }, 1_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state.countdownSeconds, state.data?.completed]);

  useEffect(() => {
    if (state.countdownSeconds > 0 || state.data?.completed) {
      return;
    }

    let cancelled = false;
    let nextPollTimer: number | null = null;

    async function runPollingLoop() {
      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
        if (cancelled) {
          return;
        }

        const nextDelayMs = attempt < MAX_POLL_ATTEMPTS ? nextPollDelayMs(attempt) : null;
        const nextDelaySeconds = nextDelayMs === null ? null : Math.ceil(nextDelayMs / 1_000);

        setState((current) => ({
          ...current,
          isPolling: true,
          error: null,
          countdownSeconds: 0,
        }));

        try {
          const response = await fetch(`/api/kyc/session/${encodeURIComponent(sessionId)}/result`, {
            method: "GET",
            cache: "no-store",
          });

          const payload = (await response.json()) as KycSessionResult | { message?: string };

          if (!response.ok) {
            throw new Error(payload && "message" in payload && payload.message ? payload.message : "Lecture impossible.");
          }

          if (cancelled) {
            return;
          }

          const parsed = payload as KycSessionResult;

          setState((current) => ({
            ...current,
            data: parsed,
            isPolling: false,
            error: null,
            attemptCount: attempt,
            attemptHistory: [
              ...current.attemptHistory,
              {
                attempt,
                checkedAt: new Date().toISOString(),
                outcome: "success",
                status: parsed.status,
                completed: parsed.completed,
                validationStatus: parsed.validationStatus,
                nextPollInSeconds: parsed.completed ? null : nextDelaySeconds,
                message: parsed.completed
                  ? "Le backend a confirme un statut final pour cette session."
                  : "Lecture backend reussie, mais aucun statut final n'est encore disponible.",
              },
            ],
          }));

          if (parsed.completed) {
            return;
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "Lecture impossible.",
            isPolling: false,
            attemptCount: attempt,
            attemptHistory: [
              ...current.attemptHistory,
              {
                attempt,
                checkedAt: new Date().toISOString(),
                outcome: "error",
                status: null,
                completed: null,
                validationStatus: null,
                nextPollInSeconds: nextDelaySeconds,
                message: error instanceof Error ? error.message : "Lecture impossible.",
              },
            ],
          }));
        }

        if (nextDelayMs !== null) {

          setState((current) => ({
            ...current,
            countdownSeconds: nextDelaySeconds ?? 0,
          }));

          await new Promise<void>((resolve) => {
            nextPollTimer = window.setTimeout(() => {
              setState((current) => ({
                ...current,
                countdownSeconds: 0,
              }));
              nextPollTimer = null;
              resolve();
            }, nextDelayMs);
          });
        }
      }
    }

    void runPollingLoop();

    return () => {
      cancelled = true;
      if (nextPollTimer !== null) {
        window.clearTimeout(nextPollTimer);
      }
    };
  }, [pollGeneration, sessionId, state.countdownSeconds, state.data?.completed]);

  const reachedPollingLimit = !state.data?.completed && state.attemptCount >= MAX_POLL_ATTEMPTS;

  const currentStatus = useMemo(() => {
    return statusLabel(state.data?.status ?? null);
  }, [state.data?.status]);

  const approvedExitHref = state.data?.validationStatus === "APPROVED" ? "/welcome" : null;

  return (
    <PageShell maxWidthClassName="max-w-4xl">
      <SurfacePanel className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">RESULT</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Resultat</h1>
          <p className="text-sm text-slate-600">Suivi du resultat de verification.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <p>{currentStatus}</p>
        </div>

        {state.countdownSeconds > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
            <Clock3 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p>{pollingMessage(state.countdownSeconds, state.attemptCount)}</p>
            </div>
          </div>
        ) : null}

        {state.isPolling ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <LoaderCircle className="size-4 animate-spin" />
            Lecture du resultat en cours.
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        {state.data ? (
          <div className={`rounded-3xl border px-5 py-4 text-sm ${decisionTone(state.data.validationStatus)}`}>
            <p className="font-semibold">{decisionTitle(state.data.validationStatus)}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-medium">Reference</p>
                <p className="break-all">{state.data.externalId ?? sessionId}</p>
              </div>
              <div>
                <p className="font-medium">Decision</p>
                <p>{validationStatusLabel(state.data.validationStatus)}</p>
              </div>
              <div>
                <p className="font-medium">Statut</p>
                <p>{state.data.status}</p>
              </div>
              <div>
                <p className="font-medium">Finalise le</p>
                <p>{state.data.completedAt ?? "—"}</p>
              </div>
            </div>
          </div>
        ) : null}

        {reachedPollingLimit ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Aucun statut final n&apos;a encore ete confirme.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setState((current) => ({
                ...current,
                data: null,
                error: null,
                attemptCount: 0,
                countdownSeconds: 0,
                isPolling: false,
                attemptHistory: [],
              }));
              setPollGeneration((current) => current + 1);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            <RefreshCcw className="size-4" />
            Actualiser
          </button>

          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            Mes verifications
          </Link>

          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Nouvelle verification
          </Link>

          {approvedExitHref ? (
            <Link
              href={approvedExitHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800"
            >
              Retour accueil
            </Link>
          ) : null}
        </div>
      </SurfacePanel>
    </PageShell>
  );
}