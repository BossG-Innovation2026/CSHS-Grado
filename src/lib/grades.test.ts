import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFinalGrade } from "./grades.ts";

describe("parseFinalGrade", () => {
  it("treats empty entries as blank", () => {
    assert.deepEqual(parseFinalGrade("   "), { kind: "blank" });
  });

  it("accepts whole numbers from 60 to 100", () => {
    assert.deepEqual(parseFinalGrade("60"), { kind: "grade", value: 60 });
    assert.deepEqual(parseFinalGrade(" 88 "), { kind: "grade", value: 88 });
    assert.deepEqual(parseFinalGrade("100"), { kind: "grade", value: 100 });
  });

  it("rejects values outside the scale", () => {
    for (const bad of ["59", "101", "0", "1000"]) assert.equal(parseFinalGrade(bad).kind, "invalid", bad);
  });

  it("rejects decimals, text and negatives", () => {
    for (const bad of ["88.5", "abc", "-75", "8 8", "E"]) assert.equal(parseFinalGrade(bad).kind, "invalid", bad);
  });
});
