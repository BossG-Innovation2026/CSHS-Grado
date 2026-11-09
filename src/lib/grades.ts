/** Final grades are entered as finished numbers; Grado never computes them. */
export const GRADE_MIN = 60;
export const GRADE_MAX = 100;

export type ParsedGrade = { kind: "blank" } | { kind: "grade"; value: number } | { kind: "invalid"; reason: string };

/** Check one entry. The same rule runs in the browser and on the server. */
export function parseFinalGrade(raw: string): ParsedGrade {
  const text = raw.trim();
  if (!text) return { kind: "blank" };
  const value = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  if (Number.isNaN(value) || value < GRADE_MIN || value > GRADE_MAX) {
    return { kind: "invalid", reason: `Enter a whole number from ${GRADE_MIN} to ${GRADE_MAX}.` };
  }
  return { kind: "grade", value };
}
