import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

export function PageShell({ children, className, maxWidthClassName = "sm:max-w-[430px]" }: PageShellProps) {
  return (
    <div
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
      }}
      className={[
        "h-[100dvh] w-full overflow-hidden bg-[var(--surface-light)] p-0 sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--background)] sm:h-full sm:max-h-[850px] sm:w-full sm:rounded-[2.5rem] sm:border sm:border-[var(--border)] sm:[box-shadow:var(--shadow-soft),0_0_0_8px_var(--border)]",
          maxWidthClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}