import Link from "next/link";
import { Lock } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { inlinePrimaryButtonClassName, surfaceInfoPanelClassName } from "@/components/ui/fixed-action-layout";

export function AccessDeniedScreen({ userLabel }: { userLabel: string }) {
  return (
    <ProtectedScreenShell
      backHref="/auth/logout"
      title="Accès"
      showBack={false}
      showLogout={false}
      pageClassName="flex items-center"
      maxWidthClassName="sm:max-w-[430px]"
      panelClassName="w-full justify-center space-y-4 !pt-0 text-center"
    >
        <div className="space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-red-100 bg-red-50 text-red-600">
            <Lock className="size-7" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Accès démo refusé</p>
        </div>
        <div className={[surfaceInfoPanelClassName, "space-y-3 rounded-3xl"].join(" ")}>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Cet accès démo n&apos;est pas autorisé.</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Ce compte ne peut pas ouvrir ce parcours.</p>
          <p className="text-sm text-[var(--muted-foreground)]">Compte courant : {userLabel}</p>
        </div>
        <div className="flex justify-center">
          <Link href="/auth/logout" className={[inlinePrimaryButtonClassName, "justify-center"].join(" ")}>
            Se déconnecter
          </Link>
        </div>
    </ProtectedScreenShell>
  );
}