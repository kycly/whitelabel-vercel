import Link from "next/link";
import { Lock } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { inlinePrimaryButtonClassName, surfaceInfoPanelClassName } from "@/components/ui/fixed-action-layout";

export function AccessDeniedScreen({ userLabel }: { userLabel: string }) {
  return (
    <ProtectedScreenShell backHref="/auth/logout" title="Accès" showBack={false} showLogout={false} pageClassName="flex items-center" maxWidthClassName="max-w-3xl" panelClassName="w-full text-center space-y-5 justify-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Lock className="size-7" />
        </div>
        <div className={[surfaceInfoPanelClassName, "space-y-3"].join(" ")}>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Cet acces demo n&apos;est pas autorise.</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Ce compte ne peut pas ouvrir ce parcours.</p>
          <p className="text-sm text-[var(--muted-foreground)]">Compte courant : {userLabel}</p>
        </div>
        <div className="flex justify-center">
          <Link href="/auth/logout" className={inlinePrimaryButtonClassName}>
            Se déconnecter
          </Link>
        </div>
    </ProtectedScreenShell>
  );
}