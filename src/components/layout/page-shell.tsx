import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

export function PageShell({ children, className, maxWidthClassName = "max-w-4xl" }: PageShellProps) {
  return (
    <main
      className={[
        "mx-auto min-h-screen w-full px-6 py-10",
        maxWidthClassName,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </main>
  );
}