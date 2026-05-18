"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

export function AuthLoadingScreen({ target }: { target: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <PageShell className="flex items-center" maxWidthClassName="max-w-3xl">
      <SurfacePanel className="animate-scale-in w-full text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">AUTH_LOADING</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ouverture</h1>
          <p className="text-sm text-slate-600">Preparation de votre espace demo.</p>
        </div>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm text-slate-600 shadow-[var(--shadow-card)]">
          <LoaderCircle className="size-4 animate-spin text-blue-600" />
          Redirection en cours...
        </div>
      </SurfacePanel>
    </PageShell>
  );
}