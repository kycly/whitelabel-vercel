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
    <ProtectedScreenShell backHref="/auth/logout" title="Accueil" maxWidthClassName="max-w-2xl" panelClassName="flex h-full flex-col pt-8">
      <div className={scrollablePanelBodyClassName}>
        <div className="mb-6 flex animate-fade-in flex-col items-center justify-center">
          <div className="relative mb-5 flex h-36 w-36 items-center justify-center rounded-full bg-[var(--surface-light)]">
            <div className="absolute inset-0 rounded-full bg-blue-100 opacity-20 scale-110" />
            <ScanFace className="h-16 w-16 text-brand" strokeWidth={1.5} aria-hidden="true" />
            <div className="absolute -right-2 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
              <ShieldCheck className="h-5 w-5 text-green-500" aria-hidden="true" />
            </div>
          </div>
          <h2 className="mb-1 text-center text-2xl font-bold text-brand">Nouvelle vérification</h2>
          <p className="text-center text-xs tracking-wide text-[var(--muted-foreground)]">{userLabel}</p>
        </div>

        <div className="mb-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] px-4 py-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
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

      <div className={[fixedFooterActionsClassName, "animate-fade-in"].join(" ")} style={{ animationDelay: "0.3s" }}>
        <Link href="/verify" className={primaryCtaClassName}>
          Commencer
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </ProtectedScreenShell>
  );
}