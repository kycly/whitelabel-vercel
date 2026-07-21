import type { ReactNode } from "react";

type SurfacePanelProps = {
  children: ReactNode;
  className?: string;
};

export function SurfacePanel({ children, className }: SurfacePanelProps) {
  return (
    <section
      className={[
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}