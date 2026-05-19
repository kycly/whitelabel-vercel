"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, History, Home, LoaderCircle, Plus, RefreshCcw } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  type WorkflowStatus,
  workflowStatusTone,
  workflowStatusValue,
} from "@/components/verify/workflow-status";
import {
  errorAlertClassName,
  infoAlertClassName,
  primaryIconButtonClassName,
  secondaryIconButtonClassName,
  surfaceInfoCardClassName,
  successIconButtonClassName,
  warningAlertClassName,
} from "@/components/ui/fixed-action-layout";

type KycSessionResult = {
  sessionId: string;
  externalId?: string;
  status: "pending" | "processing" | "completed";
  completed: boolean;
  completedAt: string | null;
  workflowStatus: WorkflowStatus | null;
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
  workflowStatus: KycSessionResult["workflowStatus"];
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

function pollingMessage(countdownSeconds: number, attemptCount: number): string {
  const nextAttempt = Math.min(attemptCount + 1, MAX_POLL_ATTEMPTS);

  if (attemptCount === 0) {
    return `Le premier appel backend partira dans ${countdownSeconds}s minimum.`;
  }

  return `Le poll ${nextAttempt}/${MAX_POLL_ATTEMPTS} partira dans ${countdownSeconds}s.`;
}

function statusTone(status: KycSessionResult["status"]): string {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function resultTone(result: KycSessionResult): string {
  return result.workflowStatus ? workflowStatusTone(result.workflowStatus) : statusTone(result.status);
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
                workflowStatus: parsed.workflowStatus,
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
                workflowStatus: null,
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

  const approvedExitHref = state.data?.workflowStatus === "APPROVED" ? "/welcome" : null;

  return (
    <ProtectedScreenShell
      backHref="/sessions"
      preferBackHref
      title="Résultat"
      maxWidthClassName="max-w-4xl"
      panelClassName="space-y-5 pt-4"
    >
        {state.data ? (
          <div className={surfaceInfoCardClassName}>
            <p>status: {state.data.status}</p>
          </div>
        ) : null}

        {state.countdownSeconds > 0 ? (
          <div className={infoAlertClassName}>
            <Clock3 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p>{pollingMessage(state.countdownSeconds, state.attemptCount)}</p>
            </div>
          </div>
        ) : null}

        {state.isPolling ? (
          <div className={[surfaceInfoCardClassName, "flex items-center gap-3"].join(" ")}>
            <LoaderCircle className="size-4 animate-spin" />
            Lecture du resultat en cours.
          </div>
        ) : null}

        {state.error ? (
          <div className={errorAlertClassName}>
            {state.error}
          </div>
        ) : null}

        {state.data ? (
          <div className={`rounded-2xl border px-5 py-4 text-sm ${resultTone(state.data)}`}>
            <p className="font-semibold">workflowStatus: {workflowStatusValue(state.data.workflowStatus)}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-medium">Reference</p>
                <p className="break-all">{state.data.externalId ?? sessionId}</p>
              </div>
              <div>
                <p className="font-medium">workflowStatus</p>
                <p>{workflowStatusValue(state.data.workflowStatus)}</p>
              </div>
              <div>
                <p className="font-medium">status</p>
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
          <div className={warningAlertClassName}>
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
            aria-label="Actualiser"
            title="Actualiser"
            className={secondaryIconButtonClassName}
          >
            <RefreshCcw className="size-4" />
            <span className="sr-only">Actualiser</span>
          </button>

          <Link
            href="/sessions"
            aria-label="Mes vérifications"
            title="Mes vérifications"
            className={secondaryIconButtonClassName}
          >
            <History className="size-4" />
            <span className="sr-only">Mes vérifications</span>
          </Link>

          <Link
            href="/verify"
            aria-label="Nouvelle vérification"
            title="Nouvelle vérification"
            className={primaryIconButtonClassName}
          >
            <Plus className="size-4" />
            <span className="sr-only">Nouvelle vérification</span>
          </Link>

          {approvedExitHref ? (
            <Link
              href={approvedExitHref}
              aria-label="Retour accueil"
              title="Retour accueil"
              className={successIconButtonClassName}
            >
              <Home className="size-4" />
              <span className="sr-only">Retour accueil</span>
            </Link>
          ) : null}
        </div>
    </ProtectedScreenShell>
  );
}