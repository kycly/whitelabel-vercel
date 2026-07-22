"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { type WorkflowStatus, VerificationStatusBadge } from "@/components/verify/workflow-status";
import { SurfaceCard, SkeletonCard } from "@kycly/ui";
import {
  errorAlertClassName,
  infoAlertClassName,
  scrollablePanelBodyClassName,
} from "@/components/ui/fixed-action-layout";
import { formatOcrLabel } from "@/lib/ocr-format";
import { ImageLightbox } from "@/components/verify/image-lightbox";
import { groupImageSides } from "@/components/verify/image-sides";
import { AppError, errorMessage } from "@/lib/app-error";
import { handleAppError, requestProtectedJson } from "@/lib/app-client";

type SessionStatus = {
  sessionId: string;
  externalId: string | null;
  kyclinkUrl: string;
  status: "pending" | "processing" | "completed";
  expiresAt: string | null;
  completedAt: string | null;
  workflowStatus: WorkflowStatus | null;
  sessionState: "ACTIVE" | "COMPLETED" | "EXPIRED";
  resumeAvailable: boolean;
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
};

const DETAIL_POLL_INTERVAL_SECONDS = 5;

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

export function VerificationDetail({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<ViewState>({
    session: null,
    detail: null,
    error: null,
    isLoading: true,
  });
  const [zoomedSide, setZoomedSide] = useState<string | null>(null);
  const [pollCountdown, setPollCountdown] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const session = await requestProtectedJson<SessionStatus>(
          `/api/kyc/session/${encodeURIComponent(sessionId)}`,
          { method: "GET", cache: "no-store" },
          { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_STATUS_FETCH_FAILED", sessionId },
        );

        let detail: Detail | null = null;
        try {
          detail = await requestProtectedJson<Detail>(
            `/api/kyc/session/${encodeURIComponent(sessionId)}/detail`,
            { method: "GET", cache: "no-store" },
            { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_DETAIL_FETCH_FAILED", sessionId },
          );
        } catch (detailError) {
          // Le backend peut renvoyer 404 juste après la fin de vérif : les données
          // détaillées (OCR/similarité) sont encore en cours de propagation en aval.
          if (!(detailError instanceof AppError) || detailError.status !== 404) {
            throw detailError;
          }
        }

        if (cancelled) {
          return;
        }

        setState({ session, detail, error: null, isLoading: false });
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (handleAppError(error)) {
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
  }, [sessionId]);

  const { session, detail, isLoading } = state;
  const isWaitingForDetail = session?.status === "completed" && !detail && !isLoading;

  useEffect(() => {
    if (!isWaitingForDetail) {
      setPollCountdown(null);
      return;
    }

    let cancelled = false;
    setPollCountdown(DETAIL_POLL_INTERVAL_SECONDS);

    async function pollDetail() {
      try {
        const polledDetail = await requestProtectedJson<Detail>(
          `/api/kyc/session/${encodeURIComponent(sessionId)}/detail`,
          { method: "GET", cache: "no-store" },
          { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_DETAIL_FETCH_FAILED", sessionId },
        );

        if (cancelled) {
          return;
        }

        setState((current) => ({ ...current, detail: polledDetail }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (!(error instanceof AppError) || error.status !== 404) {
          if (handleAppError(error)) {
            return;
          }

          setState((current) => ({ ...current, error: errorMessage(error, "Lecture impossible.") }));
        }
      }
    }

    const timer = setInterval(() => {
      setPollCountdown((current) => {
        if (current === null) {
          return current;
        }

        if (current <= 1) {
          void pollDetail();
          return DETAIL_POLL_INTERVAL_SECONDS;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, isWaitingForDetail]);
  const isCompleted = session?.status === "completed";

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
        {state.isLoading ? <SkeletonCard lines={4} /> : null}

        {state.error ? <div className={errorAlertClassName}>{state.error}</div> : null}

        {session ? (
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
                <div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round((detail.validationScore ?? 0) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-3 overflow-hidden rounded-full bg-[var(--surface)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-500"
                      style={{ width: `${Math.min((detail.validationScore ?? 0) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-mono opacity-60">
                    <span>Fiabilité du document</span>
                    <span>{Math.round((detail.validationScore ?? 0) * 100)} %</span>
                  </div>
                </div>
              ) : null}
              {detail?.faceSimilarity !== null && detail?.faceSimilarity !== undefined ? (
                <div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(detail.faceSimilarity * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-3 overflow-hidden rounded-full bg-[var(--surface)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-500"
                      style={{ width: `${Math.min(detail.faceSimilarity * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-mono opacity-60">
                    <span>Similarité du visage</span>
                    <span>{Math.round(detail.faceSimilarity * 100)} %</span>
                  </div>
                </div>
              ) : null}
            </div>
          </SurfaceCard>
        ) : null}

        {!isCompleted && session ? (
          <div className={[infoAlertClassName, "rounded-3xl"].join(" ")}>
            Vérification en cours — les données détaillées apparaîtront une fois le traitement terminé.
          </div>
        ) : null}

        {isCompleted && session && !detail ? (
          <div className={[infoAlertClassName, "rounded-3xl"].join(" ")}>
            <p>
              Décision rendue — les données détaillées (documents, similarité) finalisent leur traitement.
              Revenez dans un instant.
            </p>
            {pollCountdown !== null ? (
              <p className="mt-2 font-mono text-xs opacity-70">
                Nouvelle tentative dans {pollCountdown}s
              </p>
            ) : null}
          </div>
        ) : null}

        {isCompleted && detail && detail.imageSides.length > 0 ? (
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

        {isCompleted && detail && Object.keys(detail.ocrFront).length > 0 ? (
          <SurfaceCard variant="raised" className="px-5 py-5 text-sm shadow-[var(--shadow-soft)]">
            <OcrFields title="Recto" fields={detail.ocrFront} />
          </SurfaceCard>
        ) : null}

        {isCompleted && detail && Object.keys(detail.ocrBack).length > 0 ? (
          <SurfaceCard variant="raised" className="px-5 py-5 text-sm shadow-[var(--shadow-soft)]">
            <OcrFields title="Verso" fields={detail.ocrBack} />
          </SurfaceCard>
        ) : null}
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
