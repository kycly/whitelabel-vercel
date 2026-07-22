// Porté de partner-node/ui/src/lib/verification-utils.ts (formatFieldLabel) —
// rendu OCR dynamique, robuste à tout type de document.
export function formatOcrLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}
