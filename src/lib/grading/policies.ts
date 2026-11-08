/**
 * Grading rules from DepEd Order 015, s. 2026 (and DO 8, s. 2015 Table 5 for
 * Grade 12 in SY 2026-27). These are national rules, so they live in reviewed
 * code rather than in admin settings. See docs/grades-design.md.
 */
export type Curriculum = "strengthened" | "do8";
export type PolicyKey = "transition-2026" | "zero-based";
export type Component = "ww" | "pt" | "st1" | "st2" | "te";

/** Which tests make up the Examinations component of a subject. */
export type ExamStructure = "summative-and-term" | "term-only" | "none";

export interface GradingGroup {
  curriculum: Curriculum;
  label: string;
  ww: number;
  pt: number;
  ex: number;
  exams: ExamStructure;
}

export const GRADING_GROUPS = {
  // DO 015 Table 10
  core: { curriculum: "strengthened", label: "Core subject", ww: 20, pt: 50, ex: 30, exams: "summative-and-term" },
  academic_elective: { curriculum: "strengthened", label: "Academic elective", ww: 20, pt: 50, ex: 30, exams: "summative-and-term" },
  arts_sports_health: { curriculum: "strengthened", label: "Arts, Sports, Health and Wellness elective", ww: 20, pt: 60, ex: 20, exams: "summative-and-term" },
  field_exposure: { curriculum: "strengthened", label: "Field Exposure, Arts Apprenticeship, Creative Production and Innovation", ww: 15, pt: 70, ex: 15, exams: "term-only" },
  research_design: { curriculum: "strengthened", label: "Research elective, Design and Innovation", ww: 40, pt: 60, ex: 0, exams: "none" },
  techpro_elective: { curriculum: "strengthened", label: "TechPro elective", ww: 15, pt: 65, ex: 20, exams: "summative-and-term" },
  work_immersion: { curriculum: "strengthened", label: "Work Immersion", ww: 20, pt: 80, ex: 0, exams: "none" },
  // DO 8 Table 5, kept by DO 015 para. 49 for Grade 12 in SY 2026-27
  do8_core: { curriculum: "do8", label: "Core subject", ww: 25, pt: 50, ex: 25, exams: "summative-and-term" },
  do8_academic: { curriculum: "do8", label: "Academic track, other subject", ww: 25, pt: 45, ex: 30, exams: "summative-and-term" },
  do8_academic_applied: { curriculum: "do8", label: "Academic track: Work Immersion, Research, Business Enterprise Simulation, Exhibit, Performance", ww: 35, pt: 40, ex: 25, exams: "summative-and-term" },
  do8_tvl_sports_arts: { curriculum: "do8", label: "TVL, Sports, Arts and Design track", ww: 20, pt: 60, ex: 20, exams: "summative-and-term" },
} as const satisfies Record<string, GradingGroup>;

export type GradingGroupKey = keyof typeof GRADING_GROUPS;

export function isGradingGroup(value: string): value is GradingGroupKey {
  return Object.hasOwn(GRADING_GROUPS, value);
}

export function groupsForCurriculum(curriculum: Curriculum): { key: GradingGroupKey; label: string }[] {
  return (Object.entries(GRADING_GROUPS) as [GradingGroupKey, GradingGroup][])
    .filter(([, group]) => group.curriculum === curriculum)
    .map(([key, group]) => ({ key, label: group.label }));
}

/** Examination weights within the component (DO 015 para. 45). */
export const EXAM_SPLIT = { st1: 30, st2: 30, te: 40 } as const;

export const PASSING_GRADE = 75;
export const LOWEST_REPORTABLE_GRADE = 60;

export const POLICY_LABELS: Record<PolicyKey, string> = {
  "transition-2026": "Adjusted transmutation (SY 2026-27)",
  "zero-based": "Zero-based grading",
};

/** Adjusted transmutation applies only to SY 2026-27; zero-based follows. */
export function policyKeyForYear(startYear: number): PolicyKey {
  return startYear <= 2026 ? "transition-2026" : "zero-based";
}

/** Grade 12 has not moved to the Strengthened SHS Curriculum in SY 2026-27. */
export function curriculumFor(policyKey: PolicyKey, gradeLevelName: string): Curriculum {
  return policyKey === "transition-2026" && gradeLevelName.trim() === "Grade 12" ? "do8" : "strengthened";
}

/** Whether a group can be graded under a policy. Zero-based has no DO 8 weights. */
export function policyAllowsGroup(policyKey: PolicyKey, group: GradingGroupKey): boolean {
  return policyKey === "transition-2026" || GRADING_GROUPS[group].curriculum === "strengthened";
}
