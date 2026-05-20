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
  lockViewportScroll?: boolean;
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
  lockViewportScroll = false,
  title,
  backHref,
  preferBackHref = false,
  showBack = true,
  showLogout = true,
}: ProtectedScreenShellProps) {
  const resolvedPageClassName = [
    lockViewportScroll ? "[&_main]:overflow-y-hidden [&_main]:overscroll-none" : null,
    pageClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PageShell className={resolvedPageClassName} maxWidthClassName={maxWidthClassName}>
      <SurfacePanel>
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/80 px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
          {showBack ? (
            <BackIconButton
              fallbackHref={backHref}
              preferFallbackHref={preferBackHref}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            />
          ) : (
            <span className="w-10" />
          )}
          <h1 className="text-sm font-semibold tracking-[0.01em] text-[var(--foreground)]">{title ?? "Kycly"}</h1>
          {showLogout ? (
            <LogoutButton
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-70"
              iconOnly
              title="Déconnexion"
            />
          ) : (
            <span className="w-10" />
          )}
        </div>
        <div className={["flex min-h-0 flex-1 flex-col px-4 pb-5 pt-4 sm:px-5 sm:pb-6", panelClassName].filter(Boolean).join(" ")}>{children}</div>
      </SurfacePanel>
    </PageShell>
  );
}