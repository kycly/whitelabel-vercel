"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, FilterX, History, LoaderCircle, Plus, RefreshCcw } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  type ValidationStatus,
  validationStatusValue,
} from "@/components/verify/validation-status";
import {
  errorAlertClassName,
  featureActionCardClassName,
  formFieldClassName,
  inlinePrimaryButtonClassName,
  metricCardClassName,
  primaryIconButtonClassName,
  secondaryIconButtonClassName,
  surfaceInfoPanelClassName,
} from "@/components/ui/fixed-action-layout";

type SessionStatus = "pending" | "processing" | "completed";
type DecisionStatus = ValidationStatus;

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
  { label: "pending", value: "pending" },
  { label: "processing", value: "processing" },
  { label: "completed", value: "completed" },
];

const DECISION_OPTIONS: Array<{ label: string; value: DecisionStatus | "all" }> = [
  { label: "Toutes les validations", value: "all" },
  { label: "APPROVED", value: "APPROVED" },
  { label: "REJECTED", value: "REJECTED" },
  { label: "REVIEW", value: "REVIEW" },
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

function decisionLabel(item: SessionsResponse["data"][number]): string {
  return validationStatusValue(item.validationStatus);
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

  function resetFilters() {
    setStatus("all");
    setDecisionStatus("all");
    setOffset(0);
  }

  return (
    <ProtectedScreenShell backHref="/welcome" title="Historique" maxWidthClassName="max-w-5xl" panelClassName="space-y-6 pt-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex h-11 items-center">
            <p className="text-sm font-medium text-[var(--foreground)]">Mes vérifications</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setReloadKey((current) => current + 1);
              }}
              aria-label="Actualiser"
              title="Actualiser"
              className={secondaryIconButtonClassName}
            >
              <RefreshCcw className="size-4" />
              <span className="sr-only">Actualiser</span>
            </button>

            {hasActiveFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                aria-label="Réinitialiser les filtres"
                title="Réinitialiser les filtres"
                className={secondaryIconButtonClassName}
              >
                <FilterX className="size-4" />
                <span className="sr-only">Réinitialiser les filtres</span>
              </button>
            ) : null}

            <Link
              href="/verify"
              aria-label="Nouvelle vérification"
              title="Nouvelle vérification"
              className={primaryIconButtonClassName}
            >
              <Plus className="size-4" />
              <span className="sr-only">Nouvelle vérification</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-3xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.all}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <History className="size-4" />
              </div>
            </div>
          </div>

          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-3xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.pending + state.meta.statusCounts.processing}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Clock3 className="size-4" />
              </div>
            </div>
          </div>

          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-3xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.completed}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] p-4 sm:grid-cols-2">
        <label className="block">
          <select
            aria-label="Filtrer par statut"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SessionStatus | "all");
              setOffset(0);
            }}
            className={formFieldClassName({ compact: true })}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({state.meta.statusCounts[option.value]})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <select
            aria-label="Filtrer par décision"
            value={decisionStatus}
            onChange={(event) => {
              setDecisionStatus(event.target.value as DecisionStatus | "all");
              setOffset(0);
            }}
            className={formFieldClassName({ compact: true })}
          >
            {DECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                    {option.label} ({state.meta.decisionCounts[option.value]})
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.isLoading ? (
        <div className={[surfaceInfoPanelClassName, "flex items-center gap-3"].join(" ")}>
          <LoaderCircle className="size-4 animate-spin" />
          Lecture des verifications en cours.
        </div>
      ) : null}

      {state.error ? (
        <div className={errorAlertClassName}>{state.error}</div>
      ) : null}

      {isInitialEmpty ? (
        <div className={[surfaceInfoPanelClassName, "px-6 py-8"].join(" ")}>
          <p className="font-medium text-[var(--foreground)]">Aucune verification.</p>
          <Link
            href="/verify"
            className={[inlinePrimaryButtonClassName, "mt-4"].join(" ")}
          >
            Nouvelle vérification
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      {isFilterEmpty ? (
        <div className={[surfaceInfoPanelClassName, "flex items-center justify-between gap-4 px-6 py-6"].join(" ")}>
          <p className="font-medium text-[var(--foreground)]">Aucune verification pour ce filtre.</p>
          <button
            type="button"
            onClick={resetFilters}
            aria-label="Réinitialiser les filtres"
            title="Réinitialiser les filtres"
            className={secondaryIconButtonClassName}
          >
            <FilterX className="size-4" />
            <span className="sr-only">Réinitialiser les filtres</span>
          </button>
        </div>
      ) : null}

      {state.data.length > 0 ? (
        <div className="grid gap-4">
          {state.data.map((item) => {
            return (
              <article key={item.sessionId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h2 className="truncate text-base font-semibold text-[var(--foreground)]">{item.externalId ?? item.sessionId}</h2>
                    <p className="text-xs text-[var(--muted-foreground)]">{formatDate(item.createdAt)}</p>
                  </div>

                  <Link
                    href={`/complete?sessionId=${encodeURIComponent(item.sessionId)}`}
                    aria-label={`Voir la session ${item.externalId ?? item.sessionId}`}
                    title="Voir la session"
                    className={secondaryIconButtonClassName}
                  >
                    <ArrowUpRight className="size-4" />
                    <span className="sr-only">Voir la session</span>
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 ${statusTone(item.status)}`}>
                    {decisionLabel(item)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] p-4 text-sm text-[var(--muted-foreground)]">
        <p>
          Page {Math.floor(state.meta.offset / PAGE_SIZE) + 1} · {state.meta.returned} / {state.meta.total}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => {
              setOffset((current) => Math.max(current - PAGE_SIZE, 0));
            }}
            aria-label="Page précédente"
            title="Page précédente"
            className={secondaryIconButtonClassName}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Page précédente</span>
          </button>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => {
              setOffset((current) => current + PAGE_SIZE);
            }}
            aria-label="Page suivante"
            title="Page suivante"
            className={secondaryIconButtonClassName}
          >
            <ArrowRight className="size-4" />
            <span className="sr-only">Page suivante</span>
          </button>
        </div>
      </div>
    </ProtectedScreenShell>
  );
}