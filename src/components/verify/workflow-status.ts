export type WorkflowStatus = "PENDING" | "IN_REVIEW" | "ESCALATED" | "APPROVED" | "REJECTED";

export function workflowStatusValue(workflowStatus: WorkflowStatus | null): string {
  return workflowStatus ?? "null";
}

export function workflowStatusTone(workflowStatus: WorkflowStatus | null): string {
  if (workflowStatus === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (workflowStatus === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (workflowStatus === "ESCALATED") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (workflowStatus === "IN_REVIEW") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}