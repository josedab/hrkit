import type { DailyHRVReading } from './types.js';

/**
 * Root Mean Square of Successive Differences.
 * Primary short-term HRV metric reflecting parasympathetic activity.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @returns rMSSD value in milliseconds. Returns 0 if fewer than 2 intervals.
 */
export function rmssd(rr: number[]): number {
  if (rr.length < 2) return 0;

  let sumSquaredDiffs = 0;
  for (let i = 1; i < rr.length; i++) {
    const diff = rr[i]! - rr[i - 1]!;
    sumSquaredDiffs += diff * diff;
  }

  return Math.sqrt(sumSquaredDiffs / (rr.length - 1));
}

/**
 * Standard Deviation of NN (Normal-to-Normal) intervals.
 * Reflects overall HRV including both short and long-term variability.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @returns SDNN value in milliseconds. Returns 0 if fewer than 2 intervals.
 */
export function sdnn(rr: number[]): number {
  if (rr.length < 2) return 0;

  const mean = rr.reduce((sum, v) => sum + v, 0) / rr.length;
  const variance = rr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rr.length;

  return Math.sqrt(variance);
}

/**
 * Percentage of successive RR intervals differing by more than 50ms.
 * Another parasympathetic HRV marker.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @returns Percentage (0-100) of successive intervals differing by >50ms.
 */
export function pnn50(rr: number[]): number {
  if (rr.length < 2) return 0;

  let count = 0;
  for (let i = 1; i < rr.length; i++) {
    if (Math.abs(rr[i]! - rr[i - 1]!) > 50) {
      count++;
    }
  }

  return (count / (rr.length - 1)) * 100;
}

/**
 * Mean heart rate derived from RR intervals.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @returns Mean heart rate in BPM. Returns 0 if array is empty.
 */
export function meanHR(rr: number[]): number {
  if (rr.length === 0) return 0;

  const meanRR = rr.reduce((sum, v) => sum + v, 0) / rr.length;
  if (meanRR <= 0) return 0;

  return 60000 / meanRR;
}

/**
 * Compute a baseline rMSSD from a rolling window of daily readings.
 * Returns the median rMSSD from the most recent `windowDays` readings.
 *
 * @param readings - Array of daily HRV readings.
 * @param windowDays - Number of recent days to include.
 * @returns Median rMSSD from the window, or null if no data.
 */
export function hrBaseline(
  readings: DailyHRVReading[],
  windowDays: number,
): number | null {
  if (readings.length === 0 || windowDays <= 0) return null;

  const sorted = [...readings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-windowDays);

  if (sorted.length === 0) return null;

  const values = sorted.map((r) => r.rmssd).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[mid - 1]! + values[mid]!) / 2;
  }
  return values[mid]!;
}

/**
 * Training readiness verdict based on today's rMSSD vs baseline.
 *
 * @param todayRmssd - Today's morning rMSSD.
 * @param baseline - 7-day baseline rMSSD.
 * @returns Training readiness verdict.
 */
export function readinessVerdict(
  todayRmssd: number,
  baseline: number,
): 'go_hard' | 'moderate' | 'rest' {
  if (baseline <= 0) return 'rest';

  const ratio = todayRmssd / baseline;

  if (ratio >= 0.95) return 'go_hard';
  if (ratio >= 0.80) return 'moderate';
  return 'rest';
}
