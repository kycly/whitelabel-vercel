import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, History, Info, ScanFace, ShieldCheck } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  featureActionCardClassName,
  fixedFooterActionsClassName,
  primaryCtaClassName,
  scrollablePanelBodyClassName,
  stepCardClassName,
} from "@/components/ui/fixed-action-layout";

type WelcomeScreenProps = {
  userLabel: string;
  demoAccountId: string | null;
};

export function WelcomeScreen({ userLabel, demoAccountId }: WelcomeScreenProps) {
  return (
    <ProtectedScreenShell backHref="/auth/logout" title="Accueil" showBack={false} maxWidthClassName="sm:max-w-[430px]" panelClassName="flex h-full flex-col gap-4 !pt-0">
      <div className={[scrollablePanelBodyClassName, "pt-1"].join(" ")}>
        <div className="mb-5 flex animate-fade-in flex-col items-center justify-center text-center">
          <div className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--surface-light)]">
            <div className="absolute inset-0 scale-105 rounded-full bg-blue-100 opacity-25" />
            <ScanFace className="h-11 w-11 text-brand" strokeWidth={1.5} aria-hidden="true" />
            <div className="absolute -right-1 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
              <ShieldCheck className="h-5 w-5 text-green-500" aria-hidden="true" />
            </div>
          </div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Vérification d&apos;identité</p>
          <h2 className="mb-1 text-center text-2xl font-semibold text-[var(--foreground)]">Nouvelle vérification</h2>
          <p className="max-w-xs text-center text-sm text-[var(--muted-foreground)]">Lancez un parcours KYC clair, sécurisé et prêt à être repris si nécessaire.</p>
          <p className="mt-2 text-center text-xs tracking-wide text-[var(--muted-foreground)]">{userLabel}</p>
        </div>

        <div className="mb-4 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] px-4 py-5 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Avant de commencer</p>
            <div className="mb-1.5 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden="true" />
              <span className="text-xs text-[var(--foreground)]">Un identifiant externe pour rattacher la session</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden="true" />
              <span className="text-xs text-[var(--foreground)]">Un numéro SMS si vous voulez notifier l’utilisateur</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className={stepCardClassName}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-light)] text-[10px] font-bold text-[var(--brand-primary)]">1</span>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
                <span className="text-xs font-semibold text-[var(--foreground)]">Contexte</span>
              </div>
            </div>
            <div className={stepCardClassName}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-light)] text-[10px] font-bold text-[var(--brand-primary)]">2</span>
              <div className="flex items-center gap-1.5">
                <ScanFace className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden="true" />
                <span className="text-xs font-semibold text-[var(--foreground)]">Parcours</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
            <p className="text-[11px] italic leading-snug text-[var(--muted-foreground)]">
              {demoAccountId ? `Compte de démonstration ${demoAccountId}.` : "Le parcours reste identique à integration-node, dans un cadre white label."}
            </p>
          </div>

          <Link
            href="/sessions"
            className={[featureActionCardClassName, "flex min-h-20 items-center justify-between"].join(" ")}
          >
            <div className="space-y-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Historique</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">Retrouver une session existante</p>
              <p className="text-xs text-[var(--muted-foreground)]">Consulter les décisions, filtres et sessions déjà lancées.</p>
            </div>
            <History className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className={[fixedFooterActionsClassName, "animate-fade-in pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)]"].join(" ")} style={{ animationDelay: "0.3s" }}>
        <Link href="/verify" className={primaryCtaClassName}>
          Commencer
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </ProtectedScreenShell>
  );
}