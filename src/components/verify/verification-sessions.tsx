"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, FilterX, History, LoaderCircle, Plus, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  type WorkflowStatus,
  VerificationStatusBadge,
} from "@/components/verify/workflow-status";
import type { SessionState } from "@/components/verify/verification-view-state";
import {
  errorAlertClassName,
  fixedFooterSafeAreaClassName,
  formFieldClassName,
  inlinePrimaryButtonClassName,
  metricCardClassName,
  secondaryButtonClassName,
  primaryIconButtonClassName,
  scrollablePanelBodyClassName,
  secondaryIconButtonClassName,
  surfaceInfoPanelClassName,
} from "@/components/ui/fixed-action-layout";
import { errorMessage } from "@/lib/app-error";
import { handleAppError, requestProtectedJson } from "@/lib/app-client";
import type { SessionPeriod } from "@/lib/session-period";

type SessionStatus = "pending" | "processing" | "completed";

type Criteria = {
  q: string;
  status: SessionStatus | "all";
  workflowStatus: SessionWorkflowStatus | "all";
  period: SessionPeriod;
};

const EMPTY_CRITERIA: Criteria = { q: "", status: "all", workflowStatus: "all", period: "all" };

const PERIOD_OPTIONS: Array<{ value: SessionPeriod; label: string }> = [
  { value: "all", label: "Toute la periode" },
  { value: "30d", label: "30 derniers jours" },
  { value: "7d", label: "7 derniers jours" },
];
type SessionWorkflowStatus = WorkflowStatus;

type SessionsResponse = {
  data: Array<{
    sessionId: string;
    externalId: string | null;
    status: string;
    completedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    workflowStatus: SessionWorkflowStatus | null;
    sessionState: SessionState;
    resumeAvailable: boolean;
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
    workflowCounts: {
      all: number;
      PENDING: number;
      IN_REVIEW: number;
      ESCALATED: number;
      APPROVED: number;
      REJECTED: number;
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

const WORKFLOW_OPTIONS: Array<{ label: string; value: SessionWorkflowStatus | "all" }> = [
  { label: "Tous les statuts metier", value: "all" },
  { label: "PENDING", value: "PENDING" },
  { label: "IN_REVIEW", value: "IN_REVIEW" },
  { label: "ESCALATED", value: "ESCALATED" },
  { label: "APPROVED", value: "APPROVED" },
  { label: "REJECTED", value: "REJECTED" },
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
  // `draft` est ce que l'utilisateur compose ; `applied` est ce que l'ecran affiche. La requete
  // ne depend que de `applied` : une frappe dans le champ ne declenche aucun appel.
  const [draft, setDraft] = useState<Criteria>(EMPTY_CRITERIA);
  const [applied, setApplied] = useState<Criteria>(EMPTY_CRITERIA);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      workflowCounts: {
        all: 0,
        PENDING: 0,
        IN_REVIEW: 0,
        ESCALATED: 0,
        APPROVED: 0,
        REJECTED: 0,
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

        if (applied.status !== "all") {
          searchParams.set("status", applied.status);
        }

        if (applied.workflowStatus !== "all") {
          searchParams.set("workflowStatus", applied.workflowStatus);
        }

        if (applied.q.trim()) {
          searchParams.set("q", applied.q.trim());
        }

        if (applied.period !== "all") {
          searchParams.set("period", applied.period);
        }

        const sessions = await requestProtectedJson<SessionsResponse>(`/api/kyc/sessions?${searchParams.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }, {
          defaultMessage: "Lecture impossible.",
          defaultFailureCode: "SESSIONS_FETCH_FAILED",
        });

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

        if (handleAppError(error)) {
          return;
        }

        setState((current) => ({
          ...current,
          isLoading: false,
          error: errorMessage(error, "Lecture impossible."),
        }));
      }
    }

    void loadSessions();

    return () => {
      controller.abort();
    };
  }, [applied, offset, reloadKey]);

  const canGoBack = offset > 0;
  const canGoNext = state.meta.offset + state.meta.returned < state.meta.total;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const hasActiveFilter = JSON.stringify(applied) !== JSON.stringify(EMPTY_CRITERIA);
  const isFilterEmpty = !state.isLoading && !state.error && state.data.length === 0 && hasActiveFilter;
  const isInitialEmpty = !state.isLoading && !state.error && state.data.length === 0 && !hasActiveFilter;

  function applyCriteria() {
    setApplied(draft);
    setOffset(0);
  }

  function resetFilters() {
    setDraft(EMPTY_CRITERIA);
    setApplied(EMPTY_CRITERIA);
    setOffset(0);
  }

  return (
    <ProtectedScreenShell
      backHref="/welcome"
      preferBackHref
      title="Historique"
      maxWidthClassName="sm:max-w-[430px]"
      lockViewportScroll
      panelClassName="flex h-full flex-col gap-4 !pt-0"
    >
      <div className={[scrollablePanelBodyClassName, "pt-1"].join(" ")}>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Historique KYC</p>
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

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.all}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <History className="size-3.5" />
              </div>
            </div>
          </div>

          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.pending + state.meta.statusCounts.processing}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Clock3 className="size-3.5" />
              </div>
            </div>
          </div>

          <div className={metricCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold text-[var(--foreground)]">{state.meta.statusCounts.completed}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyCriteria();
        }}
        className="grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-4"
      >
        <div className="flex gap-2">
          <input
            type="search"
            inputMode="search"
            aria-label="Rechercher une verification"
            placeholder="Nom, prenom, reference..."
            maxLength={120}
            value={draft.q}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            className={formFieldClassName({ compact: true })}
          />
          <button
            type="button"
            aria-label="Filtres"
            title="Filtres"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            className={secondaryIconButtonClassName}
          >
            <SlidersHorizontal className="size-4" />
            <span className="sr-only">Filtres</span>
          </button>
        </div>

        {filtersOpen ? (
          <>
            <label className="block">
              <select
                aria-label="Filtrer par statut"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as SessionStatus | "all",
                  }))
                }
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
                aria-label="Filtrer par statut metier"
                value={draft.workflowStatus}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    workflowStatus: event.target.value as SessionWorkflowStatus | "all",
                  }))
                }
                className={formFieldClassName({ compact: true })}
              >
                {WORKFLOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({state.meta.workflowCounts[option.value]})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <select
                aria-label="Filtrer par periode"
                value={draft.period}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, period: event.target.value as SessionPeriod }))
                }
                className={formFieldClassName({ compact: true })}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {/* En evidence seulement quand le brouillon differe de ce qui est affiche. */}
            <button
              type="submit"
              className={isDirty ? inlinePrimaryButtonClassName : secondaryButtonClassName}
            >
              Appliquer
            </button>
          </>
        ) : null}
      </form>

      {state.isLoading && state.data.length === 0 ? (
        <div className={[surfaceInfoPanelClassName, "flex items-center gap-3 rounded-3xl"].join(" ")}>
          <LoaderCircle className="size-4 animate-spin" />
          Lecture des verifications en cours.
        </div>
      ) : null}

      {state.error ? (
        <div className={errorAlertClassName}>{state.error}</div>
      ) : null}

      {isInitialEmpty ? (
        <div className={[surfaceInfoPanelClassName, "rounded-3xl px-6 py-8"].join(" ")}>
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
        <div className={[surfaceInfoPanelClassName, "flex items-center justify-between gap-4 rounded-3xl px-6 py-6"].join(" ")}>
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

      {/* Les resultats precedents restent affiches pendant un rechargement : sinon l'ecran
          clignote a chaque recherche. */}
      {state.data.length > 0 ? (
        <div className={["grid gap-3", state.isLoading ? "opacity-60 transition-opacity" : ""].join(" ").trim()}>
          {state.data.map((item) => {
            const resumeHref = `/verify/session?sessionId=${encodeURIComponent(item.sessionId)}`;

            return (
              <article key={item.sessionId} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h2 className="truncate text-base font-semibold text-[var(--foreground)]">{item.externalId ?? item.sessionId}</h2>
                    <p className="text-xs text-[var(--muted-foreground)]">{formatDate(item.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                  <VerificationStatusBadge workflowStatus={item.workflowStatus} size="lg" />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {item.resumeAvailable ? (
                    <Link
                      href={resumeHref}
                      className={inlinePrimaryButtonClassName}
                    >
                      Reprendre
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : null}

                  <Link
                    href={`/sessions/${encodeURIComponent(item.sessionId)}`}
                    className={secondaryButtonClassName}
                  >
                    Voir le résultat
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      </div>

      <div className={fixedFooterSafeAreaClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-4 text-sm text-[var(--muted-foreground)]">
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
      </div>
    </ProtectedScreenShell>
  );
}