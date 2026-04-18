/**
 * Statistical helpers for validating @hrkit's HRV/HR computations against
 * a gold-standard reference (e.g. PhysioNet Polar H10 ECG capture).
 *
 * Two methods are exposed:
 *  - **MAPE** — Mean Absolute Percentage Error. Single scalar, easy to gate
 *    in CI. Good for tracking regressions sample-to-sample.
 *  - **Bland-Altman** — bias + 95% limits of agreement. The clinical-research
 *    standard for *agreement* between two measurement methods.
 *
 * The repo ships a small synthetic golden-master so the harness is fully
 * reproducible without external dataset downloads.
 */

export interface MAPEResult {
  /** Mean Absolute Percentage Error, expressed in percent (0–100+). */
  mape: number;
  /** Number of samples that contributed to the score. */
  n: number;
}

import { ValidationError } from './errors.js';

export function mape(reference: readonly number[], measured: readonly number[]): MAPEResult {
  if (reference.length !== measured.length) {
    throw new ValidationError(`mape: array length mismatch (${reference.length} vs ${measured.length})`);
  }
  if (reference.length === 0) return { mape: 0, n: 0 };

  let sum = 0;
  let n = 0;
  for (let i = 0; i < reference.length; i++) {
    const r = reference[i] ?? 0;
    const m = measured[i] ?? 0;
    if (r === 0) continue; // undefined behaviour for true=0
    sum += Math.abs((m - r) / r);
    n++;
  }
  return { mape: n === 0 ? 0 : (sum / n) * 100, n };
}

export interface BlandAltmanResult {
  /** Mean difference (bias). */
  bias: number;
  /** Standard deviation of the differences. */
  sd: number;
  /** Lower 95% limit of agreement (bias − 1.96·sd). */
  loaLower: number;
  /** Upper 95% limit of agreement (bias + 1.96·sd). */
  loaUpper: number;
  /** Number of paired observations. */
  n: number;
  /** Per-sample (mean, diff) tuples — useful for plotting. */
  points: Array<{ mean: number; diff: number }>;
}

/**
 * Compute Bland-Altman agreement statistics for two paired measurements.
 * Convention: `diff = measured − reference`. Positive bias means the
 * measured method tends to over-read.
 */
export function blandAltman(reference: readonly number[], measured: readonly number[]): BlandAltmanResult {
  if (reference.length !== measured.length) {
    throw new ValidationError(`blandAltman: array length mismatch (${reference.length} vs ${measured.length})`);
  }
  const n = reference.length;
  if (n === 0) {
    return { bias: 0, sd: 0, loaLower: 0, loaUpper: 0, n: 0, points: [] };
  }

  const points: Array<{ mean: number; diff: number }> = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = reference[i] ?? 0;
    const m = measured[i] ?? 0;
    const diff = m - r;
    points.push({ mean: (r + m) / 2, diff });
    sum += diff;
  }
  const bias = sum / n;
  let varSum = 0;
  for (const p of points) varSum += (p.diff - bias) ** 2;
  const sd = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;
  return {
    bias,
    sd,
    loaLower: bias - 1.96 * sd,
    loaUpper: bias + 1.96 * sd,
    n,
    points,
  };
}

// ── Validation harness ─────────────────────────────────────────────────

/**
 * Acceptance gates for an HRV/HR algorithm. Defaults are aimed at consumer
 * wellness use; tighten for clinical contexts.
 */
export interface ValidationThresholds {
  /** Maximum allowed MAPE (percent). */
  maxMape: number;
  /** Maximum allowed |bias| in the same units as the measurement. */
  maxAbsBias: number;
  /** Maximum allowed half-width of the 95% LoA. */
  maxLoaHalfWidth: number;
}

export const DEFAULT_HR_THRESHOLDS: ValidationThresholds = {
  maxMape: 5, // 5% MAPE on instantaneous HR
  maxAbsBias: 2, // ±2 bpm bias
  maxLoaHalfWidth: 6, // ±6 bpm 95% LoA
};

export const DEFAULT_RMSSD_THRESHOLDS: ValidationThresholds = {
  maxMape: 12,
  maxAbsBias: 4,
  maxLoaHalfWidth: 15,
};

export interface ValidationReport {
  passed: boolean;
  mape: MAPEResult;
  blandAltman: BlandAltmanResult;
  failures: string[];
}

export function validateAgainstReference(
  reference: readonly number[],
  measured: readonly number[],
  thresholds: ValidationThresholds,
): ValidationReport {
  const m = mape(reference, measured);
  const ba = blandAltman(reference, measured);
  const failures: string[] = [];
  if (m.mape > thresholds.maxMape) {
    failures.push(`MAPE ${m.mape.toFixed(2)}% > ${thresholds.maxMape}%`);
  }
  if (Math.abs(ba.bias) > thresholds.maxAbsBias) {
    failures.push(`|bias| ${Math.abs(ba.bias).toFixed(2)} > ${thresholds.maxAbsBias}`);
  }
  const halfWidth = (ba.loaUpper - ba.loaLower) / 2;
  if (halfWidth > thresholds.maxLoaHalfWidth) {
    failures.push(`LoA half-width ${halfWidth.toFixed(2)} > ${thresholds.maxLoaHalfWidth}`);
  }
  return { passed: failures.length === 0, mape: m, blandAltman: ba, failures };
}
