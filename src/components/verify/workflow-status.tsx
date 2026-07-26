import { StatusBadge } from "@kycly/ui";

export type WorkflowStatus = "PENDING" | "IN_REVIEW" | "ESCALATED" | "APPROVED" | "REJECTED";

export function workflowStatusValue(workflowStatus: WorkflowStatus | null): string {
  return workflowStatus ?? "TRAIT. EN COURS";
}

export function VerificationStatusBadge({
  workflowStatus,
  size,
}: {
  workflowStatus: WorkflowStatus | null;
  size?: "sm" | "lg";
}) {
  return <StatusBadge status={workflowStatusValue(workflowStatus)} size={size} />;
}
