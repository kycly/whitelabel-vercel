"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { SurfaceCard } from "@kycly/ui";

export function AuthLoadingScreen({ target }: { target: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <ProtectedScreenShell
      backHref="/auth/logout"
      title="Redirection"
      showBack={false}
      showLogout={false}
      maxWidthClassName="sm:max-w-[430px]"
      panelClassName="flex flex-1 flex-col justify-center !pt-0 text-center"
    >
      <div className="flex flex-1 items-center justify-center">
        <SurfaceCard variant="raised" className="animate-scale-in px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Session</p>
          <div className="inline-flex items-center gap-3 text-[var(--foreground)]">
            <LoaderCircle className="size-4 animate-spin text-brand" />
            Redirection en cours...
          </div>
        </SurfaceCard>
      </div>
    </ProtectedScreenShell>
  );
}