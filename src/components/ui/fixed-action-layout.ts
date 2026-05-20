export const scrollablePanelBodyClassName = "min-h-0 flex-1 overflow-y-auto pb-4";

export const fixedFooterActionsClassName = "shrink-0 pt-4";

export const primaryCtaClassName =
  "flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

export const inlinePrimaryButtonClassName =
  "inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

export const secondaryButtonClassName =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryIconButtonClassName =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

export const primaryIconButtonClassName =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/25 transition-all hover:opacity-90 active:scale-[0.98]";

export const successIconButtonClassName =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800";

export const destructiveIconButtonClassName =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700";

export const stepCardClassName =
  "flex min-h-14 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5";

export const checklistCardClassName =
  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-white";

export const featureActionCardClassName =
  "rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 transition hover:bg-white";

export const metricCardClassName =
  "min-h-20 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-3";

export const surfaceInfoCardClassName =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] px-5 py-4 text-sm text-[var(--muted-foreground)]";

export const surfaceInfoPanelClassName =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] p-5 text-sm text-[var(--muted-foreground)]";

export const errorAlertClassName =
  "rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700";

export const errorAlertWithIconClassName =
  "flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800";

export const successAlertClassName =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700";

export const warningAlertClassName =
  "rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800";

export const infoAlertClassName =
  "flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800";

export function formFieldClassName({
  hasError = false,
  compact = false,
}: {
  hasError?: boolean;
  compact?: boolean;
} = {}): string {
  return [
    "block w-full rounded-xl border bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground)] outline-none transition",
    compact ? "h-12" : "h-14",
    hasError ? "border-red-300" : "border-[var(--border)] focus:border-[var(--brand-primary)]",
  ].join(" ");
}