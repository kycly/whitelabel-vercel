"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  type WorkflowStatus,
  workflowStatusTone,
  workflowStatusValue,
} from "@/components/verify/workflow-status";
import {
  errorAlertClassName,
  infoAlertClassName,
  scrollablePanelBodyClassName,
  surfaceInfoCardClassName,
} from "@/components/ui/fixed-action-layout";
import { formatOcrLabel } from "@/lib/ocr-format";
import { formatSimilarityPercent } from "@/lib/similarity-format";
import { ImageLightbox } from "@/components/verify/image-lightbox";
import { errorMessage } from "@/lib/app-error";
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
  imageSides: string[];
};

type ViewState = {
  session: SessionStatus | null;
  detail: Detail | null;
  error: string | null;
  isLoading: boolean;
};

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
            className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--border)] py-2 last:border-0"
          >
            <p className="text-xs uppercase tracking-wide opacity-70">{formatOcrLabel(key)}</p>
            <p className="break-all text-right font-medium">{String(value)}</p>
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

        const detail = await requestProtectedJson<Detail>(
          `/api/kyc/session/${encodeURIComponent(sessionId)}/detail`,
          { method: "GET", cache: "no-store" },
          { defaultMessage: "Lecture impossible.", defaultFailureCode: "SESSION_DETAIL_FETCH_FAILED", sessionId },
        );

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

  const { session, detail } = state;
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
      <div className={[scrollablePanelBodyClassName, "pt-1"].join(" ")}>
        {state.isLoading ? (
          <div className={[surfaceInfoCardClassName, "flex items-center gap-3 rounded-3xl"].join(" ")}>
            <LoaderCircle className="size-4 animate-spin" />
            Chargement en cours.
          </div>
        ) : null}

        {state.error ? <div className={errorAlertClassName}>{state.error}</div> : null}

        {session ? (
          <div className={`rounded-3xl border px-5 py-5 text-sm ${workflowStatusTone(session.workflowStatus)}`}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
              Decision backend
            </p>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflowStatusTone(session.workflowStatus)}`}
            >
              {workflowStatusValue(session.workflowStatus)}
            </span>
            <div className="mt-4 grid gap-3 rounded-2xl bg-white/55 p-4">
              <div>
                <p className="font-medium">Reference</p>
                <p className="break-all">{session.externalId ?? session.sessionId}</p>
              </div>
              <div>
                <p className="font-medium">Finalise le</p>
                <p>{session.completedAt ?? "—"}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!isCompleted && session ? (
          <div className={[infoAlertClassName, "rounded-3xl"].join(" ")}>
            Vérification en cours — les données détaillées apparaîtront une fois le traitement terminé.
          </div>
        ) : null}

        {isCompleted && detail ? (
          <div className={[surfaceInfoCardClassName, "rounded-3xl"].join(" ")}>
            <div className="grid gap-4">
              <OcrFields title="Recto" fields={detail.ocrFront} />
              <OcrFields title="Verso" fields={detail.ocrBack} />

              {detail.faceSimilarity !== null ? (
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">Similarité faciale</p>
                    <p className="font-semibold">{formatSimilarityPercent(detail.faceSimilarity)} %</p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={formatSimilarityPercent(detail.faceSimilarity) ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${formatSimilarityPercent(detail.faceSimilarity)}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {detail.imageSides.length > 0 ? (
                <div>
                  <p className="font-medium">Images</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {detail.imageSides.map((side) => (
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
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
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
