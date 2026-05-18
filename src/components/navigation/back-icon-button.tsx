"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type BackIconButtonProps = {
  fallbackHref: string;
  className?: string;
  label?: string;
  onClick?: () => void;
};

export function BackIconButton({
  fallbackHref,
  className,
  label = "Retour",
  onClick,
}: BackIconButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={className}
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }

        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  );
}