"use client";

import { useState } from "react";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import { redirectToLogout } from "@/auth/cognito-client";

type LogoutButtonProps = {
  className?: string;
  label?: string;
  pendingLabel?: string;
  showIcon?: boolean;
  iconOnly?: boolean;
  title?: string;
};

export function LogoutButton({
  className,
  label = "Se deconnecter",
  pendingLabel = "Deconnexion...",
  showIcon = true,
  iconOnly = false,
  title,
}: LogoutButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const activeLabel = submitting ? pendingLabel : label;
  const accessibleLabel = title ?? label;

  return (
    <button
      type="button"
      className={clsx(className)}
      disabled={submitting}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={() => {
        setSubmitting(true);
        redirectToLogout();
      }}
    >
      {showIcon ? <LogOut className="size-4" /> : null}
      {iconOnly ? <span className="sr-only">{activeLabel}</span> : activeLabel}
    </button>
  );
}