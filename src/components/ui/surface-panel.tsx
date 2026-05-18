import type { ReactNode } from "react";

type SurfacePanelProps = {
  children: ReactNode;
  className?: string;
};

export function SurfacePanel({ children, className }: SurfacePanelProps) {
  return (
    <section
      className={[
        "flex min-h-full flex-1 flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}