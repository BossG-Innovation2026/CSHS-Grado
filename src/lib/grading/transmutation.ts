import type { Hundredths } from "./decimal.ts";

/**
 * Adjusted Transmutation Table, DO 015 s. 2026 Annex D Table 4 (SY 2026-27).
 * Each entry is [lowest Initial Grade in hundredths, transmuted grade].
 */
export const ADJUSTED_TRANSMUTATION: readonly (readonly [Hundredths, number])[] = [
  [9950, 100], [9832, 99], [9714, 98], [9596, 97], [9478, 96], [9360, 95],
  [9242, 94], [9124, 93], [9006, 92], [8888, 91], [8770, 90], [8652, 89],
  [8534, 88], [8416, 87], [8298, 86], [8180, 85], [8062, 84], [7944, 83],
  [7826, 82], [7708, 81], [7590, 80], [7472, 79], [7354, 78], [7236, 77],
  [7118, 76], [7000, 75], [6534, 74], [6067, 73], [5601, 72], [5134, 71],
  [4667, 70], [4201, 69], [3734, 68], [3268, 67], [2801, 66], [2335, 65],
  [1868, 64], [1401, 63], [935, 62], [468, 61], [0, 60],
];

export function transmute(initialGrade: Hundredths): number {
  for (const [lowest, grade] of ADJUSTED_TRANSMUTATION) {
    if (initialGrade >= lowest) return grade;
  }
  throw new RangeError("Initial grade cannot be negative.");
}
