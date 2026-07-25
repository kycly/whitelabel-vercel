"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Clock3, Eye, History, Home, LoaderCircle, Plus, RefreshCcw } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { type WorkflowStatus, VerificationStatusBadge } from "@/components/verify/workflow-status";
import { SurfaceCard, SkeletonCard } from "@kycly/ui";
import {
  errorAlertClassName,
  fixedFooterSafeAreaClassName,
  infoAlertClassName,
  primaryIconButtonClassName,
  scrollablePanelBodyClassName,
  secondaryIconButtonClassName,
  successIconButtonClassName,
  warningAlertClassName,
} from "@/components/ui/fixed-action-layout";
import { formatOcrLabel } from "@/lib/ocr-format";
import { ImageLightbox } from "@/components/verify/image-lightbox";
import { groupImageSides } from "@/components/verify/image-sides";
import { AppError, errorMessage } from "@/lib/app-error";
import { handleAppError, requestProtectedJson } from "@/lib/app-client";
import {
  MAX_POLL_ATTEMPTS,
  nextPollDelayMs,
  pollCountdownMessage,
  reachedPollingLimit,
} from "@/lib/verification-poll";
import {
  type SessionState,
  selectVerificationView,
  shouldPoll,
} from "@/components/verify/verification-view-state";

type SessionStatus = {
  sessionId: string;
  externalId: string | null;
  completedAt: string | null;
  workflowStatus: WorkflowStatus | null;
  sessionState: SessionState;
};

type Detail = {
  ocrFront: Record<string, unknown>;
  ocrBack: Record<string, unknown>;
  faceSimilarity: number | null;
  validationScore: number | null;
  imageSides: string[];
};

type ViewState = {
  session: SessionStatus | null;
  detail: Detail | null;
  error: string | null;
  isLoading: boolean;
  isPolling: boolean;
  attemptCount: number;
  countdownSeconds: number;
};

const INITIAL_STATE: ViewState = {
  session: null,
  detail: null,
  error: null,
  isLoading: true,
  isPolling: false,
  attemptCount: 0,
  countdownSeconds: 0,
};

// Une seule lecture pour les deux propagations backend : la décision (statut canonique, qui
// réconcilie l'amont côté partner-node) puis le détail OCR/images, qui n'a de sens qu'une fois la
// décision rendue. Un 404 sur le détail signifie « pas encore propagé », pas une erreur.
async function fetchSessionAndDetail(sessionId: string): Promise<{
  session: SessionStatus;
  detail: Detail | null;
}> {
  const session = await requestProtectedJson<SessionStatus>(
    `/api/kyc/session/${encodeURIComponent(sessionId)}`,
    { method: "GET", cache: "no-store" },
    { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_STATUS_FETCH_FAILED", sessionId },
  );

  if (session.sessionState !== "COMPLETED") {
    return { session, detail: null };
  }

  try {
    const detail = await requestProtectedJson<Detail>(
      `/api/kyc/session/${encodeURIComponent(sessionId)}/detail`,
      { method: "GET", cache: "no-store" },
      { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_DETAIL_FETCH_FAILED", sessionId },
    );

    return { session, detail };
  } catch (detailError) {
    if (detailError instanceof AppError && detailError.status === 404) {
      return { session, detail: null };
    }

    throw detailError;
  }
}

function OcrFields({ title, fields }: { title: string; fields: Record<string, unknown> }) {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="font-medium">{title}</p>
      <div className="mt-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] py-2 last:border-0"
          >
            <p className="text-xs uppercase tracking-wide opacity-60">{formatOcrLabel(key)}</p>
            <p className="break-all text-right font-bold uppercase">{String(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreGauge({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-3 overflow-hidden rounded-full bg-[var(--surface)]"
      >
        <div
          className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-500"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-mono opacity-60">
        <span>{label}</span>
        <span>{percent} %</span>
      </div>
    </div>
  );
}

export function VerificationDetail({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<ViewState>(INITIAL_STATE);
  const [pollGeneration, setPollGeneration] = useState(0);
  const [zoomedSide, setZoomedSide] = useState<string | null>(null);

  // Le rendu ne dépend QUE de l'état de session et de la présence du détail — jamais de la
  // provenance (soumission fraîche, « Voir le résultat », reprise, URL directe).
  const view = selectVerificationView({
    sessionState: state.session?.sessionState ?? null,
    hasDetail: state.detail !== null,
  });

  // Premier appel immédiat, sans délai initial : on ouvre aussi cet écran sur des vérifications
  // déjà terminées depuis l'historique.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const { session, detail } = await fetchSessionAndDetail(sessionId);

        if (cancelled) {
          return;
        }

        setState({ ...INITIAL_STATE, session, detail, isLoading: false });
      } catch (error) {
        if (cancelled || handleAppError(error)) {
          return;
        }

        setState((current) => ({
          ...current,
          error: errorMessage(error, "Lecture impossible."),
          isLoading: false,
        }));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sessionId, pollGeneration]);

  // Boucle de poll unique et bornée, commune aux deux attentes (décision puis détail). Elle ne
  // tourne que sur les vues d'attente : ni `resumable`, ni `expired`, ni `complete` ne pollent.
  useEffect(() => {
    if (!shouldPoll(view)) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    // Chaque attente (decision puis detail) est une phase distincte : le compteur repart de zero,
    // sinon le decompte annoncerait les tentatives restantes de la phase precedente.
    setState((current) => (current.attemptCount === 0 ? current : { ...current, attemptCount: 0 }));

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    async function pollLoop() {
      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
        const totalSeconds = Math.ceil(nextPollDelayMs(attempt) / 1_000);

        for (let remaining = totalSeconds; remaining > 0; remaining -= 1) {
          if (cancelled) {
            return;
          }

          setState((current) => ({ ...current, countdownSeconds: remaining }));
          await sleep(1_000);
        }

        if (cancelled) {
          return;
        }

        setState((current) => ({ ...current, countdownSeconds: 0, isPolling: true }));

        try {
          const { session, detail } = await fetchSessionAndDetail(sessionId);

          if (cancelled) {
            return;
          }

          setState((current) => ({
            ...current,
            session,
            detail,
            error: null,
            isPolling: false,
            attemptCount: attempt,
          }));
        } catch (error) {
          if (cancelled || handleAppError(error)) {
            return;
          }

          setState((current) => ({
            ...current,
            error: errorMessage(error, "Lecture impossible."),
            isPolling: false,
            attemptCount: attempt,
          }));
        }
      }
    }

    void pollLoop();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [view, sessionId, pollGeneration]);

  const { session, detail } = state;
  const isWaiting = view === "awaiting-decision" || view === "awaiting-detail";
  const pollExhausted = isWaiting && reachedPollingLimit(state.attemptCount);
  const approvedExitHref = session?.workflowStatus === "APPROVED" ? "/welcome" : null;

  function refresh() {
    setState(INITIAL_STATE);
    setPollGeneration((current) => current + 1);
  }

  return (
    <ProtectedScreenShell
      backHref="/sessions"
      preferBackHref
      title="Détail de la vérification"
      maxWidthClassName="sm:max-w-[430px]"
      lockViewportScroll
      panelClassName="flex h-full flex-col gap-4 !pt-0"
    >
      <div
        className={[
          scrollablePanelBodyClassName,
          "space-y-4 pt-1",
          !state.isLoading ? "animate-fade-in" : "",
        ].join(" ")}
      >
        {/* Sur `state.isLoading` et non sur `view === "loading"` : `view` reste « loading » tant
            que la session est nulle, donc aussi apres un echec de chargement — le squelette
            resterait alors affiche indefiniment sous le message d'erreur. */}
        {state.isLoading ? <SkeletonCard lines={4} /> : null}

        {state.error ? <div className={errorAlertClassName}>{state.error}</div> : null}

        {session && view !== "loading" && view !== "resumable" && view !== "expired" ? (
          <SurfaceCard variant="raised" className="px-5 py-5 text-sm shadow-[var(--shadow-soft)]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">
              Decision backend
            </p>
            <VerificationStatusBadge workflowStatus={session.workflowStatus} size="lg" />
            <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--surface-light)] p-4">
              <div>
                <p className="font-medium">Reference</p>
                <p className="break-all">{session.externalId ?? session.sessionId}</p>
              </div>
              <div>
                <p className="font-medium">Finalise le</p>
                <p>{session.completedAt ?? "—"}</p>
              </div>
              {detail?.validationScore !== null && detail?.validationScore !== undefined ? (
                <ScoreGauge label="Fiabilité du document" value={detail.validationScore} />
              ) : null}
              {detail?.faceSimilarity !== null && detail?.faceSimilarity !== undefined ? (
                <ScoreGauge label="Similarité du visage" value={detail.faceSimilarity} />
              ) : null}
            </div>
          </SurfaceCard>
        ) : null}

        {view === "resumable" ? (
          <div className={[infoAlertClassName, "rounded-3xl"].join(" ")}>
            <div>
              <p>Cette vérification n&apos;a pas encore été soumise.</p>
              <Link
                href={`/verify/session?sessionId=${encodeURIComponent(sessionId)}`}
                className="mt-3 inline-flex items-center gap-2 font-semibold underline"
              >
                Reprendre la vérification
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ) : null}

        {view === "expired" ? (
          <div className={[warningAlertClassName, "rounded-3xl"].join(" ")}>
            <div>
              <p>Cette session a expiré sans être soumise.</p>
              <Link href="/verify" className="mt-3 inline-flex items-center gap-2 font-semibold underline">
                Nouvelle vérification
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ) : null}

        {isWaiting && !pollExhausted ? (
          <div className={[infoAlertClassName, "rounded-3xl"].join(" ")}>
            <Clock3 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p>
                {view === "awaiting-decision"
                  ? "Vérification en cours — la décision arrive dans un instant."
                  : "Décision rendue — les données détaillées finalisent leur traitement."}
              </p>
              {state.countdownSeconds > 0 ? (
                <p className="mt-2 font-mono text-xs opacity-70">
                  {pollCountdownMessage(state.countdownSeconds, state.attemptCount)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {state.isPolling ? (
          <SurfaceCard variant="raised" className="flex items-center gap-3">
            <LoaderCircle className="size-4 animate-spin" />
            Lecture en cours.
          </SurfaceCard>
        ) : null}

        {pollExhausted ? (
          <div className={warningAlertClassName}>
            Aucun résultat final n&apos;a encore été confirmé. Utilisez « Actualiser » pour relancer.
          </div>
        ) : null}

        {view === "complete" && detail && detail.imageSides.length > 0 ? (
          <SurfaceCard variant="raised" className="shadow-[var(--shadow-soft)]">
            <div className="grid gap-4">
              {(() => {
                const { evidence, documentScans } = groupImageSides(detail.imageSides);
                return (
                  <>
                    {documentScans.length > 0 ? (
                      <div className="grid gap-2">
                        {documentScans.map((side) => (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setZoomedSide(side)}
                            className="flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-left"
                          >
                            <Eye className="size-4 opacity-70" />
                            <span className="flex-1 font-medium capitalize">{side}</span>
                            <ChevronRight className="size-4 opacity-40" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {evidence.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {evidence.map((side) => (
                          <button
                            key={side}
                            type="button"
                            aria-label={side}
                            onClick={() => setZoomedSide(side)}
                            className="overflow-hidden rounded-2xl border border-[var(--border)]"
                          >
                            <Image
                              src={`/api/kyc/session/${encodeURIComponent(sessionId)}/images/${encodeURIComponent(side)}`}
                              alt={side}
                              width={200}
                              height={200}
                              unoptimized
                              className="aspect-square object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </SurfaceCard>
        ) : null}

        {view === "complete" && detail && Object.keys(detail.ocrFront).length > 0 ? (
          <SurfaceCard variant="raised" className="px-5 py-5 text-sm shadow-[var(--shadow-soft)]">
            <OcrFields title="Recto" fields={detail.ocrFront} />
          </SurfaceCard>
        ) : null}

        {view === "complete" && detail && Object.keys(detail.ocrBack).length > 0 ? (
          <SurfaceCard variant="raised" className="px-5 py-5 text-sm shadow-[var(--shadow-soft)]">
            <OcrFields title="Verso" fields={detail.ocrBack} />
          </SurfaceCard>
        ) : null}
      </div>

      {/* Footer permanent : jamais conditionné à la provenance — c'est ce qui rend l'écran
          identique après une soumission et depuis l'historique. */}
      <div className={fixedFooterSafeAreaClassName}>
        <div className="flex flex-wrap gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] p-3">
          <button
            type="button"
            onClick={refresh}
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
      </div>

      {zoomedSide ? (
        <ImageLightbox
          src={`/api/kyc/session/${encodeURIComponent(sessionId)}/images/${encodeURIComponent(zoomedSide)}`}
          alt={zoomedSide}
          onClose={() => setZoomedSide(null)}
        />
      ) : null}
    </ProtectedScreenShell>
  );
}
