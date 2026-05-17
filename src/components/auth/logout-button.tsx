"use client";

import { useState } from "react";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import { cognitoSignOut } from "@/auth/cognito-client";

type LogoutButtonProps = {
  className?: string;
  label?: string;
  pendingLabel?: string;
  showIcon?: boolean;
};

export function LogoutButton({
  className,
  label = "Se deconnecter",
  pendingLabel = "Deconnexion...",
  showIcon = true,
}: LogoutButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      type="button"
      className={clsx(className)}
      disabled={submitting}
      onClick={() => {
        setSubmitting(true);
        cognitoSignOut();
        window.location.assign("/auth/logout");
      }}
    >
      {showIcon ? <LogOut className="size-4" /> : null}
      {submitting ? pendingLabel : label}
    </button>
  );
}