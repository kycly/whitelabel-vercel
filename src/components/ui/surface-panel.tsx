import type { ReactNode } from "react";

type SurfacePanelProps = {
  children: ReactNode;
  className?: string;
};

export function SurfacePanel({ children, className }: SurfacePanelProps) {
  return (
    <section
      className={[
        "rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[var(--shadow-soft)] backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}