/**
 * Exact two-decimal arithmetic. Scores and grades are held as integer
 * hundredths (85.76 is 8576), so a grade never depends on binary-float noise.
 */
export type Hundredths = number;

const DECIMAL = /^\d+(\.\d{1,2})?$/;

/** Parse a non-negative value with at most two decimals, or return null. */
export function parseHundredths(value: string | number): Hundredths | null {
  const text = String(value).trim();
  if (!DECIMAL.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

/** numerator / denominator, rounded half up. Both must be non-negative integers. */
export function roundDivide(numerator: number, denominator: number): number {
  const doubled = 2 * numerator + denominator;
  const divisor = 2 * denominator;
  return (doubled - (doubled % divisor)) / divisor;
}

/** A plain number for display and storage (8576 becomes 85.76). */
export function fromHundredths(value: Hundredths): number {
  return value / 100;
}
