"use client";

import Link from "next/link";
import { KycLink } from "@kycly/link/react";
import type { KycLinkErrorPayload } from "@kycly/link";
import { useRouter } from "next/navigation";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { primaryCtaClassName, surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";

type VerificationRunScreenProps = {
  sessionId: string;
  kyclinkUrl: string;
};

export function VerificationRunScreen({ sessionId, kyclinkUrl }: VerificationRunScreenProps) {
  const router = useRouter();

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
    <ProtectedScreenShell backHref="/verify" title="Parcours" showBack={false} showLogout={false} maxWidthClassName="max-w-5xl" panelClassName="flex flex-1 flex-col pt-2">
        <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
          <KycLink
            kyclinkUrl={kyclinkUrl}
            className="min-h-full w-full border-0 bg-white"
            height={736}
            onComplete={(payload) => {
              router.push(`/complete?sessionId=${encodeURIComponent(payload.sessionId)}`);
            }}
            onError={(payload) => {
              redirectToFailure(payload);
            }}
          />
        </div>
    </ProtectedScreenShell>
  );
}