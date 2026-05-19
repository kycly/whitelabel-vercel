import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { getFailurePresentation } from "@/lib/app-error";
import {
  errorAlertWithIconClassName,
  inlinePrimaryButtonClassName,
  secondaryButtonClassName,
  surfaceInfoPanelClassName,
} from "@/components/ui/fixed-action-layout";

type FailureScreenProps = {
  sessionId?: string;
  code?: string;
  message?: string;
};

export function FailureScreen({ sessionId, code, message }: FailureScreenProps) {
  const presentation = getFailurePresentation(code, message);

  return (
    <ProtectedScreenShell backHref="/welcome" title="Erreur" showBack={false} showLogout={false} maxWidthClassName="max-w-3xl" panelClassName="space-y-5 pt-4">
        <div className={errorAlertWithIconClassName}>
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p>{presentation.message}</p>
          </div>
        </div>

        <div className={[surfaceInfoPanelClassName, "grid gap-4 sm:grid-cols-2"].join(" ")}>
          <div>
            <p className="font-medium text-[var(--foreground)]">Session ID</p>
            <p className="break-all">{sessionId ?? "—"}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--foreground)]">Code</p>
            <p>{code ?? "UNKNOWN_ERROR"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={presentation.primaryHref}
            className={inlinePrimaryButtonClassName}
          >
            {presentation.primaryLabel}
          </Link>

          <Link
            href={presentation.secondaryHref}
            className={secondaryButtonClassName}
          >
            {presentation.secondaryLabel}
          </Link>
        </div>
    </ProtectedScreenShell>
  );
}