import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { BackIconButton } from "@/components/navigation/back-icon-button";
import { SurfacePanel } from "@/components/ui/surface-panel";

type ProtectedScreenShellProps = {
  children: ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
  pageClassName?: string;
  title?: string;
  backHref: string;
  preferBackHref?: boolean;
  showBack?: boolean;
  showLogout?: boolean;
};

export function ProtectedScreenShell({
  children,
  maxWidthClassName = "max-w-4xl",
  panelClassName,
  pageClassName,
  title,
  backHref,
  preferBackHref = false,
  showBack = true,
  showLogout = true,
}: ProtectedScreenShellProps) {
  return (
    <PageShell className={pageClassName} maxWidthClassName={maxWidthClassName}>
      <SurfacePanel>
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          {showBack ? (
            <BackIconButton
              fallbackHref={backHref}
              preferFallbackHref={preferBackHref}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-light)] text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            />
          ) : (
            <span className="w-9" />
          )}
          <h1 className="text-sm font-semibold text-[var(--foreground)]">{title ?? "Kycly"}</h1>
          {showLogout ? (
            <LogoutButton
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-light)] text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-70"
              iconOnly
              title="Déconnexion"
            />
          ) : (
            <span className="w-9" />
          )}
        </div>
        <div className={["flex min-h-0 flex-1 flex-col px-5 pb-6", panelClassName].filter(Boolean).join(" ")}>{children}</div>
      </SurfacePanel>
    </PageShell>
  );
}