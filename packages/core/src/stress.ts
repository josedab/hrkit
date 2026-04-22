/**
 * Composite stress index combining multiple physiological signals.
 *
 * Produces a 0–100 stress score from:
 *   - HRV coherence (parasympathetic balance)
 *   - HRV baseline ratio (recovery state)
 *   - Breathing rate extracted from RR modulation
 *   - Heart rate relative to resting
 *
 * Higher score = higher stress. Designed for real-time dashboard use.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface StressInput {
  /** Recent RR intervals in milliseconds (minimum 30 for coherence). */
  rrIntervals: number[];
  /** Current heart rate in bpm. */
  currentHR: number;
  /** Resting heart rate in bpm. */
  restHR: number;
  /** Optional: 7-day baseline rMSSD for recovery context. */
  baselineRmssd?: number;
  /** Optional: subjective wellness (1–10, where 10 = excellent). */
  subjectiveWellness?: number;
}

export interface StressResult {
  /** Composite stress score (0–100, higher = more stressed). */
  score: number;
  /** Qualitative stress level. */
  level: 'low' | 'moderate' | 'high' | 'very_high';
  /** Per-component breakdown. */
  components: {
    /** HRV-based stress (0–100). */
    hrv: number;
    /** Heart rate elevation stress (0–100). */
    heartRate: number;
    /** Breathing rate stress (0–100). */
    breathingRate: number;
    /** Recovery state stress (0–100), or null if no baseline provided. */
    recovery: number | null;
    /** Subjective stress (0–100), or null if not provided. */
    subjective: number | null;
  };
  /** Estimated breathing rate in breaths per minute, or null if insufficient data. */
  breathingRateBPM: number | null;
  /** Session rMSSD used in calculation. */
  rmssd: number;
}

export interface StressWeights {
  hrv: number;
  heartRate: number;
  breathingRate: number;
  recovery: number;
  subjective: number;
}

const DEFAULT_WEIGHTS: StressWeights = {
  hrv: 0.35,
  heartRate: 0.25,
  breathingRate: 0.2,
  recovery: 0.15,
  subjective: 0.05,
};

// ── Breathing Rate Extraction ───────────────────────────────────────────

/**
 * Estimate breathing rate from RR interval modulation (respiratory sinus arrhythmia).
 *
 * Detects the dominant frequency in the 0.15–0.4 Hz band (9–24 breaths/min)
 * using a simple autocorrelation-based approach.
 *
 * @param rr - RR intervals in milliseconds (minimum 30 required).
 * @returns Breathing rate in breaths per minute, or null if undetectable.
 *
 * @example
 * ```ts
 * const br = estimateBreathingRate(rrIntervals);
 * if (br) console.log(`Breathing: ${br} bpm`);
 * ```
 */
export function estimateBreathingRate(rr: number[]): number | null {
  if (rr.length < 30) return null;

  // Convert RR to instantaneous HR series and compute mean
  const hr = rr.map((v) => 60000 / v);
  const mean = hr.reduce((s, v) => s + v, 0) / hr.length;
  const centered = hr.map((v) => v - mean);

  // Estimate sample rate from mean RR interval
  const meanRR = rr.reduce((s, v) => s + v, 0) / rr.length;
  const fs = 1000 / meanRR; // samples per second

  // Search for dominant frequency in respiratory band (0.15–0.4 Hz)
  const minLag = Math.max(1, Math.floor(fs / 0.4)); // 0.4 Hz → shortest period
  const maxLag = Math.min(centered.length - 1, Math.ceil(fs / 0.15)); // 0.15 Hz → longest period

  if (maxLag <= minLag || maxLag >= centered.length) return null;

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < centered.length - lag; i++) {
      corr += centered[i]! * centered[i + lag]!;
    }
    corr /= centered.length - lag;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Validate: autocorrelation peak must be significant
  let variance = 0;
  for (const v of centered) variance += v * v;
  variance /= centered.length;
  if (variance === 0 || bestCorr / variance < 0.1) return null;

  const freqHz = fs / bestLag;
  const bpm = freqHz * 60;

  // Clamp to physiological range (6–30 breaths/min)
  if (bpm < 6 || bpm > 30) return null;
  return Math.round(bpm * 10) / 10;
}

// ── Component Scorers ───────────────────────────────────────────────────

function hrvStress(rr: number[]): number {
  if (rr.length < 2) return 50;

  // Compute rMSSD inline
  let sumSqDiff = 0;
  for (let i = 1; i < rr.length; i++) {
    const d = rr[i]! - rr[i - 1]!;
    sumSqDiff += d * d;
  }
  const r = Math.sqrt(sumSqDiff / (rr.length - 1));

  // Map rMSSD to stress: high rMSSD → low stress
  // Typical rMSSD: 20–80ms. Below 20 = high stress, above 60 = low stress.
  if (r >= 60) return 10;
  if (r <= 15) return 95;
  return Math.round(100 - ((r - 15) / 45) * 85);
}

function computeRmssd(rr: number[]): number {
  if (rr.length < 2) return 0;
  let sumSqDiff = 0;
  for (let i = 1; i < rr.length; i++) {
    const d = rr[i]! - rr[i - 1]!;
    sumSqDiff += d * d;
  }
  return Math.sqrt(sumSqDiff / (rr.length - 1));
}

function hrElevationStress(currentHR: number, restHR: number): number {
  if (restHR <= 0) return 50;
  const elevation = currentHR / restHR;
  // 1.0x rest = 0 stress, 2.0x rest = 100 stress
  return Math.round(Math.min(100, Math.max(0, (elevation - 1) * 100)));
}

function breathingStress(bpm: number | null): number {
  if (bpm === null) return 50; // unknown → neutral
  // Optimal: 6–12 bpm (coherent breathing). Stress rises above 15 bpm.
  if (bpm <= 12) return Math.round(Math.max(0, (bpm - 6) * (20 / 6)));
  if (bpm <= 20) return Math.round(20 + ((bpm - 12) / 8) * 50);
  return Math.round(Math.min(100, 70 + ((bpm - 20) / 10) * 30));
}

function recoveryStress(rmssdVal: number, baseline: number): number {
  if (baseline <= 0) return 50;
  const ratio = rmssdVal / baseline;
  // ≥0.95 → well recovered (low stress), <0.7 → poor recovery (high stress)
  if (ratio >= 0.95) return 10;
  if (ratio <= 0.6) return 95;
  return Math.round(100 - ((ratio - 0.6) / 0.35) * 85);
}

function subjectiveStress(wellness: number): number {
  // Wellness 10 = 0 stress, wellness 1 = 100 stress
  return Math.round(Math.max(0, Math.min(100, (10 - wellness) * (100 / 9))));
}

function scoreToLevel(score: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (score < 30) return 'low';
  if (score < 55) return 'moderate';
  if (score < 75) return 'high';
  return 'very_high';
}

// ── Main API ────────────────────────────────────────────────────────────

/**
 * Compute a composite stress score from multiple physiological signals.
 *
 * @param input - Current physiological state.
 * @param weights - Optional custom weights for each component (must sum to ~1.0).
 * @returns Composite stress result with per-component breakdown.
 *
 * @example
 * ```ts
 * const result = computeStress({
 *   rrIntervals: recentRR, currentHR: 72, restHR: 60,
 *   baselineRmssd: 45, subjectiveWellness: 7,
 * });
 * console.log(result.score); // 0–100
 * console.log(result.level); // 'low' | 'moderate' | 'high' | 'very_high'
 * ```
 */
export function computeStress(input: StressInput, weights?: Partial<StressWeights>): StressResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Sanitize inputs: treat NaN/Infinity as safe defaults
  const currentHR = Number.isFinite(input.currentHR) ? Math.max(0, input.currentHR) : 0;
  const restHR = Number.isFinite(input.restHR) && input.restHR > 0 ? input.restHR : 60;
  const rrIntervals = input.rrIntervals.filter((v) => Number.isFinite(v) && v > 0);

  const hrvScore = hrvStress(rrIntervals);
  const hrScore = hrElevationStress(currentHR, restHR);
  const br = estimateBreathingRate(rrIntervals);
  const brScore = breathingStress(br);
  const rmssdVal = computeRmssd(rrIntervals);

  const hasRecovery = input.baselineRmssd != null && Number.isFinite(input.baselineRmssd) && input.baselineRmssd > 0;
  const recScore = hasRecovery ? recoveryStress(rmssdVal, input.baselineRmssd!) : null;

  const hasSubjective = input.subjectiveWellness != null && Number.isFinite(input.subjectiveWellness);
  const subjScore = hasSubjective ? subjectiveStress(Math.max(1, Math.min(10, input.subjectiveWellness!))) : null;

  // Weighted average — redistribute missing component weights proportionally
  let totalWeight = w.hrv + w.heartRate + w.breathingRate;
  let weighted = hrvScore * w.hrv + hrScore * w.heartRate + brScore * w.breathingRate;

  if (recScore !== null) {
    totalWeight += w.recovery;
    weighted += recScore * w.recovery;
  }
  if (subjScore !== null) {
    totalWeight += w.subjective;
    weighted += subjScore * w.subjective;
  }

  const score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 50;

  return {
    score: Math.max(0, Math.min(100, score)),
    level: scoreToLevel(score),
    components: {
      hrv: hrvScore,
      heartRate: hrScore,
      breathingRate: brScore,
      recovery: recScore,
      subjective: subjScore,
    },
    breathingRateBPM: br,
    rmssd: Math.round(rmssdVal * 100) / 100,
  };
}
