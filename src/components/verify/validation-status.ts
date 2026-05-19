export type ValidationStatus = "APPROVED" | "REJECTED" | "REVIEW";

export function validationStatusValue(validationStatus: ValidationStatus | null): string {
  return validationStatus ?? "null";
}

export function validationStatusTone(validationStatus: ValidationStatus | null): string {
  if (validationStatus === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (validationStatus === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (validationStatus === "REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}