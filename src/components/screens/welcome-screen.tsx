import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

type WelcomeScreenProps = {
  userLabel: string;
  demoAccountId: string | null;
};

export function WelcomeScreen({ userLabel, demoAccountId }: WelcomeScreenProps) {
  return (
    <PageShell maxWidthClassName="max-w-4xl">
      <SurfacePanel className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">WELCOME</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Nouvelle verification</h1>
            <p className="text-sm text-slate-600">Preparez la session avant de commencer.</p>
          </div>

          <LogoutButton className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <p>{userLabel}</p>
          <p>{demoAccountId ?? "Compte demo non determine"}</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700"
          >
            Commencer
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            Mes verifications
            <History className="size-4" />
          </Link>
        </div>
      </SurfacePanel>
    </PageShell>
  );
}