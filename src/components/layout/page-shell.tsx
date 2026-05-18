import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

export function PageShell({ children, className, maxWidthClassName = "max-w-4xl" }: PageShellProps) {
  return (
    <div
      className={[
        "min-h-screen w-full bg-[var(--surface-light)] p-0 sm:flex sm:items-center sm:justify-center sm:p-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex h-[100dvh] w-full flex-col bg-[var(--background)] sm:h-[850px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[2.5rem] sm:border sm:border-[var(--border)] sm:[box-shadow:var(--shadow-soft),0_0_0_8px_var(--border)]",
          maxWidthClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <main className="relative flex w-full flex-1 flex-col overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}