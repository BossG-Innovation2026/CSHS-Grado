import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADJUSTED_TRANSMUTATION,
  GRADING_GROUPS,
  computeFinalGrade,
  computeTermGrade,
  curriculumFor,
  descriptorFor,
  groupsForCurriculum,
  isGradingGroup,
  isPassing,
  parseHundredths,
  policyAllowsGroup,
  policyKeyForYear,
  roundDivide,
  transmute,
  type AssessmentInput,
  type ScoreInput,
} from "./index.ts";

function sheet(rows: [id: string, component: AssessmentInput["component"], highest: number, raw: number | "excused"][]) {
  const assessments: AssessmentInput[] = rows.map(([id, component, highestScore]) => ({ id, component, highestScore }));
  const scores: Record<string, ScoreInput> = {};
  for (const [id, , , raw] of rows) {
    scores[id] = raw === "excused" ? { status: "excused" } : { status: "scored", rawScore: raw };
  }
  return { assessments, scores };
}

const FULL_MARKS = sheet([
  ["w1", "ww", 20, 20],
  ["p1", "pt", 20, 20],
  ["s1", "st1", 20, 20],
  ["s2", "st2", 20, 20],
  ["t1", "te", 60, 60],
]);

describe("decimal helpers", () => {
  it("parses up to two decimals exactly", () => {
    assert.equal(parseHundredths("17.5"), 1750);
    assert.equal(parseHundredths(20), 2000);
    assert.equal(parseHundredths("0.07"), 7);
  });

  it("rejects negatives, text and extra decimals", () => {
    for (const bad of ["-1", "abc", "1.234", "", "1e3"]) assert.equal(parseHundredths(bad), null, bad);
  });

  it("rounds halves up", () => {
    assert.equal(roundDivide(5, 2), 3);
    assert.equal(roundDivide(4, 3), 1);
    assert.equal(roundDivide(0, 3), 0);
  });
});

describe("DO 015 worked examples", () => {
  const table5 = sheet([
    ["w1", "ww", 20, 17],
    ["w2", "ww", 25, 22],
    ["w3", "ww", 20, 20],
    ["w4", "ww", 20, 15],
    ["p1", "pt", 25, 20],
    ["p2", "pt", 25, 23],
    ["s1", "st1", 20, 15],
    ["s2", "st2", 20, 18],
    ["t1", "te", 40, 35],
  ]);

  it("Annex D Table 5: Initial Grade transmutes to 88", () => {
    const result = computeTermGrade({ policyKey: "transition-2026", group: "core", ...table5 });
    assert.ok(result.ok);
    assert.equal(result.exPs, 84.5);
    assert.equal(result.termGrade, 88);
  });

  it("Annex D Table 6: zero-based reports 84 without transmutation", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "core",
      ...sheet([
        ["w1", "ww", 20, 15],
        ["w2", "ww", 25, 22],
        ["w3", "ww", 20, 20],
        ["p1", "pt", 25, 20],
        ["p2", "pt", 25, 23],
        ["p3", "pt", 25, 20],
        ["s1", "st1", 25, 19],
        ["s2", "st2", 20, 16],
        ["t1", "te", 50, 42],
      ]),
    });
    assert.ok(result.ok);
    assert.equal(result.exPs, 80.4);
    assert.equal(result.ptPs, 84);
    assert.equal(result.initialGrade, 83.66);
    assert.equal(result.termGrade, 84);
  });
});

describe("adjusted transmutation table", () => {
  it("covers every grade from 100 down to 60 once", () => {
    assert.deepEqual(
      ADJUSTED_TRANSMUTATION.map(([, grade]) => grade),
      Array.from({ length: 41 }, (_, i) => 100 - i)
    );
  });

  it("has strictly falling thresholds ending at zero", () => {
    for (let i = 1; i < ADJUSTED_TRANSMUTATION.length; i++) {
      assert.ok(ADJUSTED_TRANSMUTATION[i][0] < ADJUSTED_TRANSMUTATION[i - 1][0]);
    }
    assert.equal(ADJUSTED_TRANSMUTATION.at(-1)?.[0], 0);
  });

  it("switches grade exactly on each band edge", () => {
    for (const [lowest, grade] of ADJUSTED_TRANSMUTATION) {
      assert.equal(transmute(lowest), grade);
      if (lowest > 0) assert.equal(transmute(lowest - 1), grade - 1);
    }
  });

  it("matches the upper bounds printed in the order", () => {
    assert.equal(transmute(10000), 100);
    assert.equal(transmute(7117), 75);
    assert.equal(transmute(6999), 74);
    assert.equal(transmute(6533), 73);
    assert.equal(transmute(467), 60);
  });
});

describe("weights", () => {
  it("add up to 100 for every group", () => {
    for (const [key, group] of Object.entries(GRADING_GROUPS)) {
      assert.equal(group.ww + group.pt + group.ex, 100, key);
    }
  });

  it("have no exam weight exactly when there are no exams", () => {
    for (const [key, group] of Object.entries(GRADING_GROUPS)) {
      assert.equal(group.ex === 0, group.exams === "none", key);
    }
  });

  it("match DO 015 Table 10 and DO 8 Table 5", () => {
    const expected: Record<string, [number, number, number]> = {
      core: [20, 50, 30],
      academic_elective: [20, 50, 30],
      arts_sports_health: [20, 60, 20],
      field_exposure: [15, 70, 15],
      research_design: [40, 60, 0],
      techpro_elective: [15, 65, 20],
      work_immersion: [20, 80, 0],
      do8_core: [25, 50, 25],
      do8_academic: [25, 45, 30],
      do8_academic_applied: [35, 40, 25],
      do8_tvl_sports_arts: [20, 60, 20],
    };
    assert.deepEqual(Object.keys(GRADING_GROUPS).sort(), Object.keys(expected).sort());
    for (const [key, weights] of Object.entries(expected)) {
      const group = GRADING_GROUPS[key as keyof typeof GRADING_GROUPS];
      assert.deepEqual([group.ww, group.pt, group.ex], weights, key);
    }
  });

  it("apply to a learner's percentages", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "work_immersion",
      ...sheet([
        ["w1", "ww", 100, 50],
        ["p1", "pt", 100, 100],
      ]),
    });
    assert.ok(result.ok);
    assert.equal(result.exPs, null);
    assert.equal(result.initialGrade, 90);
  });
});

describe("computeTermGrade", () => {
  it("gives full marks 100 under both policies", () => {
    for (const policyKey of ["transition-2026", "zero-based"] as const) {
      const result = computeTermGrade({ policyKey, group: "core", ...FULL_MARKS });
      assert.ok(result.ok);
      assert.equal(result.termGrade, 100);
    }
  });

  it("floors at 60 under zero-based but keeps the real Initial Grade", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "core",
      ...sheet([
        ["w1", "ww", 20, 0],
        ["p1", "pt", 20, 0],
        ["s1", "st1", 20, 0],
        ["s2", "st2", 20, 0],
        ["t1", "te", 60, 0],
      ]),
    });
    assert.ok(result.ok);
    assert.equal(result.initialGrade, 0);
    assert.equal(result.termGrade, 60);
  });

  it("uses the Term Exam alone for the Field Exposure group", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "field_exposure",
      ...sheet([
        ["w1", "ww", 10, 10],
        ["p1", "pt", 10, 10],
        ["t1", "te", 60, 30],
      ]),
    });
    assert.ok(result.ok);
    assert.equal(result.exPs, 50);
    assert.equal(result.initialGrade, 92.5);
  });

  it("rejects summative tests where only the Term Exam applies", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "field_exposure",
      ...sheet([
        ["w1", "ww", 10, 10],
        ["p1", "pt", 10, 10],
        ["s1", "st1", 20, 20],
        ["t1", "te", 60, 30],
      ]),
    });
    assert.deepEqual(result, { ok: false, problems: [{ code: "unexpected-exam", assessmentId: "s1" }] });
  });

  it("rejects exams for subjects with no Examinations component", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "research_design",
      ...sheet([
        ["w1", "ww", 10, 10],
        ["p1", "pt", 10, 10],
        ["t1", "te", 60, 30],
      ]),
    });
    assert.equal(result.ok, false);
  });

  it("leaves excused tasks out of the highest-score total", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "research_design",
      ...sheet([
        ["w1", "ww", 10, 5],
        ["w2", "ww", 90, "excused"],
        ["p1", "pt", 10, 10],
      ]),
    });
    assert.ok(result.ok);
    assert.equal(result.wwPs, 50);
  });

  it("refuses to excuse an exam", () => {
    const { assessments, scores } = FULL_MARKS;
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "core",
      assessments,
      scores: { ...scores, s1: { status: "excused" } },
    });
    assert.deepEqual(result, { ok: false, problems: [{ code: "exam-excused", assessmentId: "s1" }] });
  });

  it("refuses when every task in a component is excused", () => {
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "research_design",
      ...sheet([
        ["w1", "ww", 10, "excused"],
        ["p1", "pt", 10, 10],
      ]),
    });
    assert.deepEqual(result, { ok: false, problems: [{ code: "all-excused", component: "ww" }] });
  });

  it("reports a blank score instead of counting it as zero", () => {
    const { assessments, scores } = FULL_MARKS;
    const rest = Object.fromEntries(Object.entries(scores).filter(([id]) => id !== "w1"));
    const result = computeTermGrade({ policyKey: "zero-based", group: "core", assessments, scores: rest });
    assert.deepEqual(result, { ok: false, problems: [{ code: "missing-score", assessmentId: "w1" }] });
  });

  it("rejects a score above the highest possible", () => {
    const { assessments, scores } = FULL_MARKS;
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "core",
      assessments,
      scores: { ...scores, w1: { status: "scored", rawScore: 21 } },
    });
    assert.deepEqual(result, { ok: false, problems: [{ code: "score-above-highest", assessmentId: "w1" }] });
  });

  it("names each missing component", () => {
    const result = computeTermGrade({ policyKey: "zero-based", group: "core", assessments: [], scores: {} });
    assert.ok(!result.ok);
    assert.deepEqual(
      result.problems.map((p) => (p.code === "missing-assessment" ? p.component : p.code)),
      ["ww", "pt", "st1", "st2", "te"]
    );
  });

  it("rejects two copies of one exam", () => {
    const { assessments, scores } = FULL_MARKS;
    const result = computeTermGrade({
      policyKey: "zero-based",
      group: "core",
      assessments: [...assessments, { id: "t2", component: "te", highestScore: 60 }],
      scores: { ...scores, t2: { status: "scored", rawScore: 1 } },
    });
    assert.deepEqual(result, { ok: false, problems: [{ code: "duplicate-exam", component: "te" }] });
  });

  it("refuses DO 8 weights once zero-based grading starts", () => {
    const result = computeTermGrade({ policyKey: "zero-based", group: "do8_core", ...FULL_MARKS });
    assert.deepEqual(result, { ok: false, problems: [{ code: "policy-mismatch" }] });
  });
});

describe("final grade and descriptors", () => {
  it("averages and rounds to a whole number", () => {
    assert.equal(computeFinalGrade([75, 76, 76]), 76);
    assert.equal(computeFinalGrade([74, 75]), 75);
    assert.equal(computeFinalGrade([88]), 88);
  });

  it("needs at least one term grade", () => {
    assert.throws(() => computeFinalGrade([]), RangeError);
  });

  it("passes at 75", () => {
    assert.equal(isPassing(75), true);
    assert.equal(isPassing(74), false);
  });

  it("maps every band edge", () => {
    const cases: [number, string][] = [
      [100, "Advancing"], [90, "Advancing"], [89, "Benchmarking"], [80, "Benchmarking"],
      [79, "Connecting"], [75, "Connecting"], [74, "Developing"], [65, "Developing"],
      [64, "Emerging"], [0, "Emerging"],
    ];
    for (const [grade, label] of cases) assert.equal(descriptorFor(grade).label, label);
  });
});

describe("policy selection", () => {
  it("uses the adjusted table only through SY 2026-27", () => {
    assert.equal(policyKeyForYear(2026), "transition-2026");
    assert.equal(policyKeyForYear(2027), "zero-based");
  });

  it("keeps only Grade 12 on DO 8 weights in SY 2026-27", () => {
    assert.equal(curriculumFor("transition-2026", "Grade 12"), "do8");
    assert.equal(curriculumFor("transition-2026", "Grade 11"), "strengthened");
    assert.equal(curriculumFor("zero-based", "Grade 12"), "strengthened");
  });

  it("offers each curriculum only its own groups", () => {
    assert.equal(groupsForCurriculum("strengthened").length, 7);
    assert.equal(groupsForCurriculum("do8").length, 4);
  });

  it("recognises group keys and rejects inherited names", () => {
    assert.equal(isGradingGroup("core"), true);
    assert.equal(isGradingGroup("toString"), false);
  });

  it("allows DO 8 groups only during the transition", () => {
    assert.equal(policyAllowsGroup("transition-2026", "do8_core"), true);
    assert.equal(policyAllowsGroup("zero-based", "do8_core"), false);
    assert.equal(policyAllowsGroup("zero-based", "core"), true);
  });
});
