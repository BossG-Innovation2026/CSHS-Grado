/**
 * Grading constants shared by server code, pages and print views.
 * DepEd scale: 60–100, 75 is passing. One final grade per subject, per term.
 *
 * A grade may also carry three assessment components (each 0–100 percent):
 * Written Work, Performance Task and Other Assessment Components. When all
 * three are encoded, the final grade is the weighted average using the
 * weights stored on the subject offering (DepEd weights vary by subject).
 */
export const GRADING = {
  min: 60,
  max: 100,
  passing: 75,
  componentMin: 0,
  componentMax: 100,
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

export const COMPONENT_LABELS = {
  writtenWork: "Written Works",
  performanceTask: "Performance Tasks",
  otherAssessment: "Other Components",
} as const;

export type ComponentKey = keyof typeof COMPONENT_LABELS;

/** Default DepEd-style weights; overridable per subject offering. */
export const DEFAULT_WEIGHTS = {
  writtenWork: 30,
  performanceTask: 50,
  otherAssessment: 20,
} as const;

export interface GradeWeights {
  writtenWork: number;
  performanceTask: number;
  otherAssessment: number;
}

export interface GradeComponents {
  writtenWork: number | null;
  performanceTask: number | null;
  otherAssessment: number | null;
}

export function isValidGrade(value: number): boolean {
  return Number.isInteger(value) && value >= GRADING.min && value <= GRADING.max;
}

export function isValidComponent(value: number): boolean {
  return Number.isInteger(value) && value >= GRADING.componentMin && value <= GRADING.componentMax;
}

export function weightsTotal(weights: GradeWeights): number {
  return weights.writtenWork + weights.performanceTask + weights.otherAssessment;
}

export function hasAllComponents(components: GradeComponents): boolean {
  return (
    components.writtenWork !== null &&
    components.performanceTask !== null &&
    components.otherAssessment !== null
  );
}

/** Weighted component average, rounded and clamped to the DepEd 60–100 scale. */
export function computeFinalGrade(
  components: GradeComponents,
  weights: GradeWeights = DEFAULT_WEIGHTS
): number | null {
  if (!hasAllComponents(components)) return null;
  const total = weightsTotal(weights) || 100;
  const weighted =
    ((components.writtenWork ?? 0) * weights.writtenWork +
      (components.performanceTask ?? 0) * weights.performanceTask +
      (components.otherAssessment ?? 0) * weights.otherAssessment) /
    total;
  return Math.min(GRADING.max, Math.max(GRADING.min, Math.round(weighted)));
}

export function remarkFor(value: number | null): string {
  if (value === null) return "—";
  return value >= GRADING.passing ? "Passed" : "Failed";
}
