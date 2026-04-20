/**
 * Atrial fibrillation screening from RR interval analysis.
 *
 * Uses validated statistical methods to detect irregular rhythm patterns:
 *   1. **Shannon entropy** of ΔRR histogram — high entropy indicates irregularity
 *   2. **Poincaré plot** — SD1/SD2 ratio reflects short/long-term variability
 *   3. **Coefficient of variation** of RR intervals
 *   4. **Turning point ratio** — tests randomness of successive differences
 *
 * ⚠️ NOT A MEDICAL DEVICE. This is a screening tool only. Users must be
 * advised to consult a clinician for any detected irregularity.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type RhythmClassification = 'normal' | 'irregular' | 'inconclusive';

export interface AFibScreeningResult {
  /** Overall rhythm classification. */
  classification: RhythmClassification;
  /** Confidence in the classification (0–1). */
  confidence: number;
  /** Shannon entropy of ΔRR histogram (bits). Higher = more irregular. */
  shannonEntropy: number;
  /** Poincaré SD1 — short-term variability (ms). */
  sd1: number;
  /** Poincaré SD2 — long-term variability (ms). */
  sd2: number;
  /** SD1/SD2 ratio. Values >0.6 suggest irregularity. */
  sd1sd2Ratio: number;
  /** Coefficient of variation of RR intervals (%). */
  rrCoefficientOfVariation: number;
  /** Turning point ratio. Values outside 0.6–0.72 suggest non-sinus rhythm. */
  turningPointRatio: number;
  /** Number of RR intervals analyzed. */
  sampleCount: number;
  /** Medical disclaimer — always present. */
  disclaimer: string;
}

export interface AFibScreeningOptions {
  /** Minimum RR intervals required. Default: 60 (~1 minute at 60 bpm). */
  minSamples?: number;
  /** Shannon entropy threshold for irregular classification. Default: 3.0 bits. */
  entropyThreshold?: number;
  /** SD1/SD2 ratio threshold. Default: 0.6. */
  sd1sd2Threshold?: number;
  /** CV threshold (%). Default: 15. */
  cvThreshold?: number;
}

const DISCLAIMER =
  'This is a screening tool only and NOT a medical device. ' +
  'It cannot diagnose atrial fibrillation or any cardiac condition. ' +
  'Consult a qualified healthcare professional for medical evaluation.';

// ── Shannon Entropy ─────────────────────────────────────────────────────

/**
 * Compute Shannon entropy of ΔRR interval histogram.
 *
 * Bins successive RR differences into 10ms-wide bins and computes
 * information entropy. Normal sinus rhythm produces lower entropy
 * (concentrated bins) while AF produces higher entropy (spread).
 *
 * @param rr - RR intervals in milliseconds (minimum 3 required).
 * @returns Shannon entropy in bits. Returns 0 for insufficient data.
 *
 * @example
 * ```ts
 * const entropy = shannonEntropyRR(rrIntervals);
 * console.log(entropy > 3.0 ? 'High irregularity' : 'Normal range');
 * ```
 */
export function shannonEntropyRR(rr: number[]): number {
  if (rr.length < 3) return 0;

  const diffs: number[] = [];
  for (let i = 1; i < rr.length; i++) {
    diffs.push(rr[i]! - rr[i - 1]!);
  }

  // Bin into 10ms bins
  const binWidth = 10;
  const bins = new Map<number, number>();
  for (const d of diffs) {
    const bin = Math.floor(d / binWidth);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }

  // Shannon entropy: -Σ(p * log2(p))
  const n = diffs.length;
  let entropy = 0;
  for (const count of bins.values()) {
    const p = count / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  return Math.round(entropy * 1000) / 1000;
}

// ── Poincaré Plot ───────────────────────────────────────────────────────

/**
 * Compute Poincaré plot descriptors (SD1, SD2) from RR intervals.
 *
 * SD1 = short-term variability (beat-to-beat), sensitive to parasympathetic
 * SD2 = long-term variability, reflects overall variability
 */
export function poincareDescriptors(rr: number[]): { sd1: number; sd2: number } {
  if (rr.length < 3) return { sd1: 0, sd2: 0 };

  let sumDiffSq = 0;
  let sumSumSq = 0;
  const n = rr.length - 1;
  const mean2 = (rr.reduce((s, v) => s + v, 0) / rr.length) * 2;

  for (let i = 0; i < n; i++) {
    const x = rr[i]!;
    const y = rr[i + 1]!;
    const diff = y - x;
    const sum = x + y - mean2;
    sumDiffSq += diff * diff;
    sumSumSq += sum * sum;
  }

  const sd1 = Math.sqrt(sumDiffSq / (2 * n));
  const sd2 = Math.sqrt(sumSumSq / (2 * n));

  return {
    sd1: Math.round(sd1 * 100) / 100,
    sd2: Math.round(sd2 * 100) / 100,
  };
}

// ── Turning Point Ratio ─────────────────────────────────────────────────

/**
 * Compute turning point ratio of RR intervals.
 *
 * A turning point occurs when RR[i] is a local extremum. For random data,
 * the expected ratio is 2/3 ≈ 0.667. Significantly higher ratios suggest
 * irregularity; lower ratios suggest trending patterns.
 */
export function turningPointRatio(rr: number[]): number {
  if (rr.length < 3) return 0;

  let turningPoints = 0;
  for (let i = 1; i < rr.length - 1; i++) {
    const prev = rr[i - 1]!;
    const curr = rr[i]!;
    const next = rr[i + 1]!;
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      turningPoints++;
    }
  }

  return Math.round((turningPoints / (rr.length - 2)) * 1000) / 1000;
}

// ── Main Screening API ──────────────────────────────────────────────────

/**
 * Screen RR intervals for atrial fibrillation indicators.
 *
 * Combines multiple validated metrics to classify rhythm as normal,
 * irregular, or inconclusive. Requires at least 60 RR intervals
 * (~1 minute of data) for reliable results.
 *
 * @param rr - RR intervals in milliseconds.
 * @param options - Optional thresholds and configuration.
 * @returns Screening result with classification, metrics, and mandatory disclaimer.
 *
 * @example
 * ```ts
 * const result = screenForAFib(rrIntervals);
 * if (result.classification === 'irregular') {
 *   console.warn(result.disclaimer);
 *   console.log(`Confidence: ${result.confidence}`);
 * }
 * ```
 */
export function screenForAFib(rr: number[], options?: AFibScreeningOptions): AFibScreeningResult {
  const minSamples = options?.minSamples ?? 60;
  const entropyThresh = options?.entropyThreshold ?? 3.0;
  const sd1sd2Thresh = options?.sd1sd2Threshold ?? 0.6;
  const cvThresh = options?.cvThreshold ?? 15;

  if (rr.length < minSamples) {
    return {
      classification: 'inconclusive',
      confidence: 0,
      shannonEntropy: 0,
      sd1: 0,
      sd2: 0,
      sd1sd2Ratio: 0,
      rrCoefficientOfVariation: 0,
      turningPointRatio: 0,
      sampleCount: rr.length,
      disclaimer: DISCLAIMER,
    };
  }

  const entropy = shannonEntropyRR(rr);
  const poincare = poincareDescriptors(rr);
  const sd1sd2 = poincare.sd2 > 0 ? poincare.sd1 / poincare.sd2 : 0;
  const tpr = turningPointRatio(rr);

  // CV of RR
  const mean = rr.reduce((s, v) => s + v, 0) / rr.length;
  const variance = rr.reduce((s, v) => s + (v - mean) ** 2, 0) / rr.length;
  const cv = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0;

  // Scoring: each metric contributes to an irregularity score (0–1)
  const scores: number[] = [];
  scores.push(entropy > entropyThresh ? 1 : entropy / entropyThresh);
  scores.push(sd1sd2 > sd1sd2Thresh ? 1 : sd1sd2 / sd1sd2Thresh);
  scores.push(cv > cvThresh ? 1 : cv / cvThresh);

  // TPR deviation from expected 0.667
  const tprDev = Math.abs(tpr - 0.667);
  scores.push(tprDev > 0.1 ? 1 : tprDev / 0.1);

  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

  let classification: RhythmClassification;
  let confidence: number;

  if (avgScore > 0.7) {
    classification = 'irregular';
    confidence = Math.min(0.95, 0.5 + avgScore * 0.4);
  } else if (avgScore < 0.35) {
    classification = 'normal';
    confidence = Math.min(0.95, 0.5 + (1 - avgScore) * 0.4);
  } else {
    classification = 'inconclusive';
    confidence = 0.3 + Math.abs(avgScore - 0.5) * 0.4;
  }

  // Boost confidence with more data
  if (rr.length >= 300) confidence = Math.min(0.95, confidence + 0.1);
  else if (rr.length >= 120) confidence = Math.min(0.95, confidence + 0.05);

  return {
    classification,
    confidence: Math.round(confidence * 100) / 100,
    shannonEntropy: entropy,
    sd1: poincare.sd1,
    sd2: poincare.sd2,
    sd1sd2Ratio: Math.round(sd1sd2 * 1000) / 1000,
    rrCoefficientOfVariation: Math.round(cv * 100) / 100,
    turningPointRatio: tpr,
    sampleCount: rr.length,
    disclaimer: DISCLAIMER,
  };
}
