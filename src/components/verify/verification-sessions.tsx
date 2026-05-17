"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, History, LoaderCircle, RefreshCcw } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

type SessionStatus = "pending" | "processing" | "completed";
type DecisionStatus = "APPROVED" | "REJECTED" | "REVIEW";

type SessionsResponse = {
  data: Array<{
    sessionId: string;
    externalId: string | null;
    status: string;
    completed: boolean;
    completedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    validationStatus: "APPROVED" | "REJECTED" | "REVIEW" | null;
  }>;
  meta: {
    returned: number;
    limit: number;
    offset: number;
    total: number;
    statusCounts: {
      all: number;
      pending: number;
      processing: number;
      completed: number;
    };
    decisionCounts: {
      all: number;
      APPROVED: number;
      REJECTED: number;
      REVIEW: number;
    };
  };
};

type SessionsState = {
  data: SessionsResponse["data"];
  meta: SessionsResponse["meta"];
  isLoading: boolean;
  error: string | null;
};

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ label: string; value: SessionStatus | "all" }> = [
  { label: "Toutes", value: "all" },
  { label: "En attente", value: "pending" },
  { label: "En analyse", value: "processing" },
  { label: "Terminees", value: "completed" },
];

const DECISION_OPTIONS: Array<{ label: string; value: DecisionStatus | "all" }> = [
  { label: "Toutes les decisions", value: "all" },
  { label: "Favorables", value: "APPROVED" },
  { label: "Rejetees", value: "REJECTED" },
  { label: "En revue", value: "REVIEW" },
];

function statusTone(status: string): string {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function decisionTone(validationStatus: SessionsResponse["data"][number]["validationStatus"]): string {
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

function decisionTitle(item: SessionsResponse["data"][number]): string {
  if (item.validationStatus === "APPROVED") {
    return "Decision favorable confirmee";
  }

  if (item.validationStatus === "REJECTED") {
    return "Decision de rejet confirmee";
  }

  if (item.validationStatus === "REVIEW") {
    return "Decision en revue manuelle";
  }

  if (item.completed) {
    return "Decision finale encore indisponible";
  }

  return "Decision backend non encore disponible";
}

function decisionMessage(item: SessionsResponse["data"][number]): string {
  if (item.validationStatus === "APPROVED") {
    return "Le backend a confirme une issue favorable pour cette verification.";
  }

  if (item.validationStatus === "REJECTED") {
    return "Le backend a confirme une issue negative pour cette verification.";
  }

  if (item.validationStatus === "REVIEW") {
    return "Le backend demande encore une revue humaine avant cloture metier.";
  }

  if (item.completed) {
    return "Le parcours est termine, mais la decision metier finale n'est pas encore remontee dans la liste.";
  }

  if (item.status === "processing") {
    return "Le backend traite encore cette session avant toute decision metier.";
  }

  return "La session existe, mais aucun resultat backend exploitable n'est encore disponible.";
}

function contextualAction(item: SessionsResponse["data"][number]): {
  href: string;
  label: string;
  className: string;
} | null {
  if (item.validationStatus === "APPROVED") {
    return {
      href: "/welcome",
      label: "Clore et revenir a l'accueil",
      className: "inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700",
    };
  }

  if (item.validationStatus === "REJECTED") {
    return {
      href: "/verify",
      label: "Relancer une verification",
      className: "inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700",
    };
  }

  if (item.validationStatus === "REVIEW") {
    return {
      href: `/complete?sessionId=${encodeURIComponent(item.sessionId)}`,
      label: "Suivre la revue detaillee",
      className: "inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-600",
    };
  }

  if (item.completed) {
    return {
      href: `/complete?sessionId=${encodeURIComponent(item.sessionId)}`,
      label: "Voir le statut detaille",
      className: "inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950",
    };
  }

  return null;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function VerificationSessions() {
  const [status, setStatus] = useState<SessionStatus | "all">("all");
  const [decisionStatus, setDecisionStatus] = useState<DecisionStatus | "all">("all");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<SessionsState>({
    data: [],
    meta: {
      returned: 0,
      limit: PAGE_SIZE,
      offset: 0,
      total: 0,
      statusCounts: {
        all: 0,
        pending: 0,
        processing: 0,
        completed: 0,
      },
      decisionCounts: {
        all: 0,
        APPROVED: 0,
        REJECTED: 0,
        REVIEW: 0,
      },
    },
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));

      try {
        const searchParams = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });

        if (status !== "all") {
          searchParams.set("status", status);
        }

        if (decisionStatus !== "all") {
          searchParams.set("decisionStatus", decisionStatus);
        }

        const response = await fetch(`/api/kyc/sessions?${searchParams.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
              ? payload.message
              : "Lecture impossible.";

          throw new Error(message);
        }

        const sessions = payload as SessionsResponse;

        setState({
          data: sessions.data,
          meta: sessions.meta,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: error instanceof Error ? error.message : "Lecture impossible.",
        }));
      }
    }

    void loadSessions();

    return () => {
      controller.abort();
    };
  }, [decisionStatus, offset, reloadKey, status]);

  const canGoBack = offset > 0;
  const canGoNext = state.meta.offset + state.meta.returned < state.meta.total;
  const hasActiveFilter = status !== "all" || decisionStatus !== "all";
  const isFilterEmpty = !state.isLoading && !state.error && state.data.length === 0 && hasActiveFilter;
  const isInitialEmpty = !state.isLoading && !state.error && state.data.length === 0 && !hasActiveFilter;

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <SurfacePanel className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] backdrop-blur-sm">
              <History className="size-4 text-blue-600" />
              Historique demo
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Suivez vos verifications KYC demo</h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                Cette vue relit les sessions connues de partner-node sandbox pour votre compte demo courant, afin de suivre l&apos;etat metier sans maintenir de copie locale supplementaire dans l&apos;application.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setReloadKey((current) => current + 1);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <RefreshCcw className="size-4" />
              Rafraichir
            </button>

            <Link
              href="/welcome"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <ArrowLeft className="size-4" />
              Retour a l&apos;accueil
            </Link>

            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Nouvelle session
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-slate-50 p-4">
          {STATUS_OPTIONS.map((option) => {
            const isActive = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatus(option.value);
                  setOffset(0);
                }}
                className={
                  isActive
                    ? "rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                }
              >
                {option.label} ({state.meta.statusCounts[option.value]})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-slate-50 p-4">
          {DECISION_OPTIONS.map((option) => {
            const isActive = decisionStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setDecisionStatus(option.value);
                  setOffset(0);
                }}
                className={
                  isActive
                    ? "rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                }
              >
                {option.label} ({state.meta.decisionCounts[option.value]})
              </button>
            );
          })}
        </div>

        {state.isLoading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <LoaderCircle className="size-4 animate-spin" />
            Lecture en cours des sessions via le backend applicatif puis partner-node sandbox.
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{state.error}</div>
        ) : null}

        {isInitialEmpty ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-sm text-slate-600">
            <p className="font-medium text-slate-950">Aucune verification demo n&apos;a encore ete enregistree.</p>
            <p className="mt-2">Lancez une premiere session KYC pour commencer a alimenter cet historique associe a votre compte demo.</p>
          </div>
        ) : null}

        {isFilterEmpty ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-8 text-sm text-slate-600">
            <p className="font-medium text-slate-950">Aucune verification ne correspond a ce filtre.</p>
            <p className="mt-2">Essayez un autre statut, une autre decision metier, ou revenez a la vue complete pour relire l&apos;historique integral de votre compte demo.</p>
          </div>
        ) : null}

        {state.data.length > 0 ? (
          <div className="grid gap-4">
            {state.data.map((item) => {
              const action = contextualAction(item);

              return (
                <article key={item.sessionId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                        {item.status}
                      </div>
                      <h2 className="text-lg font-semibold text-slate-950">{item.externalId ?? item.sessionId}</h2>
                      <p className="text-sm text-slate-500">Session ID: <span className="break-all text-slate-700">{item.sessionId}</span></p>
                    </div>

                    {action ? (
                      <Link href={action.href} className={action.className}>
                        {action.label}
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-4">
                    <div>
                      <p className="font-medium text-slate-950">Creee le</p>
                      <p>{formatDate(item.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-950">Expire le</p>
                      <p>{formatDate(item.expiresAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-950">Finalisee</p>
                      <p>{item.completed ? "oui" : "non"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-950">Completee le</p>
                      <p>{formatDate(item.completedAt)}</p>
                    </div>
                  </div>

                  <div className={`mt-4 rounded-3xl border px-4 py-4 text-sm ${decisionTone(item.validationStatus)}`}>
                    <p className="font-semibold">{decisionTitle(item)}</p>
                    <p className="mt-1">{decisionMessage(item)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-blue-600" />
            <p>
              Page courante : {Math.floor(state.meta.offset / PAGE_SIZE) + 1} · Elements charges : {state.meta.returned} / {state.meta.total}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() => {
                setOffset((current) => Math.max(current - PAGE_SIZE, 0));
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="size-4" />
              Precedent
            </button>

            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => {
                setOffset((current) => current + PAGE_SIZE);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </SurfacePanel>
    </PageShell>
  );
}