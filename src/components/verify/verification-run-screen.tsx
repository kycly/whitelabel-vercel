"use client";

import { KycLink } from "@kycly/link/react";
import type { KycLinkErrorPayload } from "@kycly/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  createParentOriginHandshakeMessage,
  resolveKyclinkOrigin,
} from "@/lib/kyclink-embed";

type VerificationRunScreenProps = {
  sessionId: string;
  kyclinkUrl: string;
};

export function VerificationRunScreen({ sessionId, kyclinkUrl }: VerificationRunScreenProps) {
  const router = useRouter();
  const iframeContainerRef = useRef<HTMLDivElement | null>(null);
  const handshakeIntervalRef = useRef<number | null>(null);
  const kyclinkOrigin = useMemo(() => resolveKyclinkOrigin(kyclinkUrl), [kyclinkUrl]);

  const stopHandshake = useCallback(() => {
    if (handshakeIntervalRef.current !== null) {
      window.clearInterval(handshakeIntervalRef.current);
      handshakeIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopHandshake();

    const container = iframeContainerRef.current;
    if (!container) {
      return;
    }

    const iframe = container.querySelector("iframe");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return;
    }

    const message = createParentOriginHandshakeMessage(sessionId);
    const sendHandshake = () => {
      iframe.contentWindow?.postMessage(message, kyclinkOrigin);
    };

    sendHandshake();
    handshakeIntervalRef.current = window.setInterval(sendHandshake, 500);

    return stopHandshake;
  }, [kyclinkOrigin, sessionId, stopHandshake]);

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

  return (
    <ProtectedScreenShell
      backHref="/verify"
      title="Parcours"
      showBack={false}
      showLogout={false}
      maxWidthClassName="sm:max-w-5xl"
      panelClassName="flex min-h-0 flex-1 flex-col !px-0 !pb-0 !pt-0"
    >
        <div ref={iframeContainerRef} className="flex min-h-0 flex-1 overflow-hidden border-y border-[var(--border)] bg-[var(--background)] sm:rounded-b-[1.75rem] sm:border-x">
          <KycLink
            kyclinkUrl={kyclinkUrl}
            className="h-full min-h-full w-full border-0 bg-white"
            height="100%"
            onReady={() => {
              stopHandshake();
            }}
            onComplete={(payload) => {
              stopHandshake();
              router.push(`/complete?sessionId=${encodeURIComponent(payload.sessionId)}`);
            }}
            onError={(payload) => {
              stopHandshake();
              redirectToFailure(payload);
            }}
          />
        </div>
    </ProtectedScreenShell>
  );
}