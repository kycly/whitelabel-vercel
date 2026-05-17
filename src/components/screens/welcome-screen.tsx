import Link from "next/link";
import { ArrowRight, BadgeCheck, History, ShieldCheck } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

type WelcomeScreenProps = {
  userLabel: string;
  demoAccountId: string | null;
};

export function WelcomeScreen({ userLabel, demoAccountId }: WelcomeScreenProps) {
  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <SurfacePanel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">WELCOME</p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
              Votre espace demo est pret. Lancez une verification guidee en toute confiance.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              L&apos;application reutilise votre compte demo autorise pour creer la session cote serveur, sans exposer de cle machine dans le navigateur.
            </p>
          </div>

          <LogoutButton className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-950">
              <BadgeCheck className="size-4 text-blue-600" />
              Utilisateur connecte
            </div>
            <p>{userLabel}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-950">
              <ShieldCheck className="size-4 text-blue-600" />
              Compte demo
            </div>
            <p>{demoAccountId ?? "Non determine"}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-950">
              <ArrowRight className="size-4 text-blue-600" />
              Prochaine etape
            </div>
            <p>Renseigner un contexte metier simple avant la creation de session.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700"
          >
            Configurer une session
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            Suivre mes verifications
            <History className="size-4" />
          </Link>
        </div>
      </SurfacePanel>
    </PageShell>
  );
}