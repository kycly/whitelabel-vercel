import { Lock } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

export function AccessDeniedScreen({ userLabel }: { userLabel: string }) {
  return (
    <PageShell className="flex items-center" maxWidthClassName="max-w-3xl">
      <SurfacePanel className="w-full text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <Lock className="size-7" />
        </div>
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-600">ACCESS_DENIED</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Cet acces demo n&apos;est pas autorise.</h1>
          <p className="text-sm leading-7 text-slate-600">
            Le compte authentifie ne porte pas encore les claims requis pour ouvrir un parcours de verification depuis cette application.
          </p>
          <p className="text-sm text-slate-500">Compte courant : {userLabel}</p>
        </div>

        <LogoutButton className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" />
      </SurfacePanel>
    </PageShell>
  );
}