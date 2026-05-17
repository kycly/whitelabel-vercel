import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

const trustPoints = [
  "Connexion securisee via Cognito",
  "Acces reserve aux comptes demo autorises",
  "Aucun secret KYCLY expose dans le navigateur",
];

export function LoginScreen() {
  return (
    <PageShell className="flex items-center" maxWidthClassName="max-w-6xl">
      <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <section className="animate-fade-in space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <Sparkles className="size-4 text-blue-600" />
            Espace demo KYCLY
          </div>

          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Verification guidee</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Connectez-vous pour ouvrir un parcours de verification rassurant.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              Accedez a votre espace demo securise, retrouvez votre historique et lancez une session KYC en quelques etapes claires.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustPoints.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 text-sm leading-6 text-slate-600 shadow-[var(--shadow-card)] backdrop-blur-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <SurfacePanel className="animate-slide-up">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <LockKeyhole className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Connexion securisee</h2>
                <p className="text-sm text-slate-500">Votre acces depend d&apos;un compte demo deja autorise.</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Vous serez redirige vers Cognito, puis l&apos;application vous ramenera automatiquement vers votre espace de verification demo.
            </div>

            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700"
            >
              Se connecter
              <ArrowRight className="size-4" />
            </Link>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-950">
                <ShieldCheck className="size-4 text-blue-600" />
                Controle d&apos;acces J1
              </div>
              <ul className="space-y-2">
                <li>Le compte doit etre provisionne dans le meme user pool Cognito.</li>
                <li>Le backend valide les claims d&apos;acces avant toute creation de session.</li>
                <li>La session applicative reste cote serveur via cookie HTTP-only.</li>
              </ul>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </PageShell>
  );
}