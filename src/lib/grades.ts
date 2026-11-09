/**
 * Grading constants shared by server code, pages and print views.
 * DepEd scale: 60–100, 75 is passing. One grade per subject, per term.
 */
export const GRADING = {
  min: 60,
  max: 100,
  passing: 75,
} as const;

export type SubmissionStatus = "draft" | "submitted" | "verified" | "approved" | "returned";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified by adviser",
  approved: "Approved by registrar",
  completed: "Completed",
  returned: "Returned for correction",
  rejected: "Rejected",
};

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-panel-hover text-muted",
  pending: "bg-warning/15 text-warning",
  submitted: "bg-warning/20 text-warning",
  verified: "bg-info/15 text-info",
  approved: "bg-success/20 text-success",
  completed: "bg-success/15 text-success",
  returned: "bg-danger/15 text-danger",
  rejected: "bg-danger/20 text-danger",
};

export function isValidGrade(value: number): boolean {
  return Number.isInteger(value) && value >= GRADING.min && value <= GRADING.max;
}

export function remarkFor(value: number | null): string {
  if (value === null) return "—";
  return value >= GRADING.passing ? "Passed" : "Failed";
}
