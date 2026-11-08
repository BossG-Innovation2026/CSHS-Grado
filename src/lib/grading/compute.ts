import { fromHundredths, parseHundredths, roundDivide, type Hundredths } from "./decimal.ts";
import {
  EXAM_SPLIT,
  GRADING_GROUPS,
  LOWEST_REPORTABLE_GRADE,
  PASSING_GRADE,
  policyAllowsGroup,
  type Component,
  type GradingGroupKey,
  type PolicyKey,
} from "./policies.ts";
import { transmute } from "./transmutation.ts";

export interface AssessmentInput {
  id: string;
  component: Component;
  highestScore: string | number;
}

export type ScoreInput = { status: "scored"; rawScore: string | number } | { status: "excused" };

export type GradeProblem =
  | { code: "policy-mismatch" }
  | { code: "missing-assessment"; component: Component }
  | { code: "duplicate-exam"; component: Component }
  | { code: "unexpected-exam"; assessmentId: string }
  | { code: "invalid-highest-score"; assessmentId: string }
  | { code: "missing-score"; assessmentId: string }
  | { code: "invalid-score"; assessmentId: string }
  | { code: "score-above-highest"; assessmentId: string }
  | { code: "exam-excused"; assessmentId: string }
  | { code: "all-excused"; component: Component };

export type TermGradeResult =
  | {
      ok: true;
      wwPs: number;
      ptPs: number;
      /** Null when the subject has no Examinations component. */
      exPs: number | null;
      initialGrade: number;
      termGrade: number;
    }
  | { ok: false; problems: GradeProblem[] };

/** Scale to two decimals, half up, at each step (design section 13, item 6). */
function percentage(raw: Hundredths, highest: Hundredths): Hundredths {
  return roundDivide(raw * 10000, highest);
}

function applyPercent(value: Hundredths, percent: number): Hundredths {
  return roundDivide(value * percent, 100);
}

interface Counted {
  raw: Hundredths;
  highest: Hundredths;
}

/** Parse one learner's score, recording anything that stops the computation. */
function readScore(
  assessment: AssessmentInput,
  score: ScoreInput | undefined,
  problems: GradeProblem[]
): Counted | null {
  const assessmentId = assessment.id;
  const highest = parseHundredths(assessment.highestScore);
  if (highest === null || highest === 0) {
    problems.push({ code: "invalid-highest-score", assessmentId });
    return null;
  }
  if (!score) {
    problems.push({ code: "missing-score", assessmentId });
    return null;
  }
  if (score.status === "excused") {
    return null;
  }
  const raw = parseHundredths(score.rawScore);
  if (raw === null) {
    problems.push({ code: "invalid-score", assessmentId });
    return null;
  }
  if (raw > highest) {
    problems.push({ code: "score-above-highest", assessmentId });
    return null;
  }
  return { raw, highest };
}

/** WW or PT: total raw over total highest, leaving out excused tasks. */
function taskPercentage(
  component: "ww" | "pt",
  assessments: AssessmentInput[],
  scores: Record<string, ScoreInput>,
  problems: GradeProblem[]
): Hundredths {
  const tasks = assessments.filter((a) => a.component === component);
  if (tasks.length === 0) {
    problems.push({ code: "missing-assessment", component });
    return 0;
  }
  let raw = 0;
  let highest = 0;
  for (const task of tasks) {
    const counted = readScore(task, scores[task.id], problems);
    if (counted) {
      raw += counted.raw;
      highest += counted.highest;
    }
  }
  if (highest === 0) {
    if (tasks.every((t) => scores[t.id]?.status === "excused")) problems.push({ code: "all-excused", component });
    return 0;
  }
  return percentage(raw, highest);
}

/** One exam as a percentage. Exams cannot be excused: learners take a make-up. */
function examPercentage(
  component: "st1" | "st2" | "te",
  assessments: AssessmentInput[],
  scores: Record<string, ScoreInput>,
  problems: GradeProblem[]
): Hundredths {
  const exams = assessments.filter((a) => a.component === component);
  if (exams.length === 0) {
    problems.push({ code: "missing-assessment", component });
    return 0;
  }
  if (exams.length > 1) {
    problems.push({ code: "duplicate-exam", component });
    return 0;
  }
  const [exam] = exams;
  if (scores[exam.id]?.status === "excused") {
    problems.push({ code: "exam-excused", assessmentId: exam.id });
    return 0;
  }
  const counted = readScore(exam, scores[exam.id], problems);
  return counted ? percentage(counted.raw, counted.highest) : 0;
}

/**
 * One learner's term grade for one subject (DO 015 Annex D, steps 1-5).
 * `scores` is keyed by assessment id.
 */
export function computeTermGrade(input: {
  policyKey: PolicyKey;
  group: GradingGroupKey;
  assessments: AssessmentInput[];
  scores: Record<string, ScoreInput>;
}): TermGradeResult {
  const { policyKey, group, assessments, scores } = input;
  if (!policyAllowsGroup(policyKey, group)) return { ok: false, problems: [{ code: "policy-mismatch" }] };

  const weights = GRADING_GROUPS[group];
  const problems: GradeProblem[] = [];

  for (const assessment of assessments) {
    const notAllowed =
      (weights.exams === "none" && ["st1", "st2", "te"].includes(assessment.component)) ||
      (weights.exams === "term-only" && ["st1", "st2"].includes(assessment.component));
    if (notAllowed) problems.push({ code: "unexpected-exam", assessmentId: assessment.id });
  }

  const wwPs = taskPercentage("ww", assessments, scores, problems);
  const ptPs = taskPercentage("pt", assessments, scores, problems);

  let exPs: Hundredths | null = null;
  if (weights.exams === "term-only") {
    exPs = examPercentage("te", assessments, scores, problems);
  } else if (weights.exams === "summative-and-term") {
    exPs =
      applyPercent(examPercentage("st1", assessments, scores, problems), EXAM_SPLIT.st1) +
      applyPercent(examPercentage("st2", assessments, scores, problems), EXAM_SPLIT.st2) +
      applyPercent(examPercentage("te", assessments, scores, problems), EXAM_SPLIT.te);
  }

  if (problems.length > 0) return { ok: false, problems };

  const initialGrade =
    applyPercent(wwPs, weights.ww) + applyPercent(ptPs, weights.pt) + (exPs === null ? 0 : applyPercent(exPs, weights.ex));

  const termGrade =
    policyKey === "transition-2026"
      ? transmute(initialGrade)
      : Math.max(LOWEST_REPORTABLE_GRADE, roundDivide(initialGrade, 100));

  return {
    ok: true,
    wwPs: fromHundredths(wwPs),
    ptPs: fromHundredths(ptPs),
    exPs: exPs === null ? null : fromHundredths(exPs),
    initialGrade: fromHundredths(initialGrade),
    termGrade,
  };
}

/** Average of whole-number term grades, rounded to a whole number (DO 015 para. 52). */
export function computeFinalGrade(termGrades: number[]): number {
  if (termGrades.length === 0) throw new RangeError("A final grade needs at least one term grade.");
  return roundDivide(
    termGrades.reduce((sum, grade) => sum + grade, 0),
    termGrades.length
  );
}

export function isPassing(grade: number): boolean {
  return grade >= PASSING_GRADE;
}

export interface Descriptor {
  label: string;
  filipino: string;
}

/** DO 015 Table 11. */
export function descriptorFor(grade: number): Descriptor {
  if (grade >= 90) return { label: "Advancing", filipino: "Namumukod-tangi" };
  if (grade >= 80) return { label: "Benchmarking", filipino: "Napamamalas" };
  if (grade >= 75) return { label: "Connecting", filipino: "Natutungo" };
  if (grade >= 65) return { label: "Developing", filipino: "Napauunlad" };
  return { label: "Emerging", filipino: "Nagsisimula" };
}
