export type ValidationStatus = "APPROVED" | "REJECTED" | "REVIEW";

export type DisplayValidationStatus = ValidationStatus | "PENDING";

export function toDisplayValidationStatus(validationStatus: ValidationStatus | null): DisplayValidationStatus {
  return validationStatus ?? "PENDING";
}

export function validationStatusLabel(validationStatus: ValidationStatus | null): DisplayValidationStatus {
  return toDisplayValidationStatus(validationStatus);
}

export function validationStatusHeadline(validationStatus: ValidationStatus | null): string {
  return `Validation ${toDisplayValidationStatus(validationStatus)}`;
}

export function validationStatusTone(validationStatus: ValidationStatus | null): string {
  const displayStatus = toDisplayValidationStatus(validationStatus);

  if (displayStatus === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (displayStatus === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (displayStatus === "REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}