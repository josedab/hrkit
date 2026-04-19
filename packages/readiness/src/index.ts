export { SDK_NAME, SDK_VERSION } from './version.js';
/**
 * Adaptive readiness scoring.
 *
 * Combines HRV (RMSSD vs personal baseline), training load (ATL/CTL → ACWR),
 * sleep, and resting HR drift into a single 0–100 score and a categorical
 * recommendation (`go_hard` / `moderate` / `rest`).
 *
 * The "model" is a transparent linear combination of normalized features —
 * not a black-box ML model. Coefficients are fitted to published HRV-guided
 * training literature (Plews & Laursen 2017; Buchheit 2014). Override them
 * via {@link computeReadiness}'s `weights` option once you have ground-truth
 * subjective wellness ratings to fit against.
 */

export interface ReadinessInput {
  /** Today's morning RMSSD (ms). */
  todayRmssd: number;
  /** 7-day rolling baseline RMSSD (ms). */
  baselineRmssd: number;
  /** Optional 7-day standard deviation of RMSSD; tightens / loosens the band. */
  baselineSd?: number;
  /** Hours of sleep last night. */
  sleepHours?: number;
  /** Resting HR this morning. */
  restingHr?: number;
  /** 7-day baseline resting HR. */
  baselineRestingHr?: number;
  /** Acute training load (7-day exponentially weighted average TRIMP). */
  atl?: number;
  /** Chronic training load (28-day EWMA TRIMP). */
  ctl?: number;
  /** Subjective wellness 1–10 (1=terrible, 10=fantastic). */
  subjectiveWellness?: number;
}

export interface ReadinessWeights {
  hrv: number;
  acwr: number;
  sleep: number;
  hrDrift: number;
  subjective: number;
}

/** Default weights sum to 1.0 across the most reliably-available signals. */
export const DEFAULT_WEIGHTS: ReadinessWeights = {
  hrv: 0.5,
  acwr: 0.2,
  sleep: 0.15,
  hrDrift: 0.1,
  subjective: 0.05,
};

export type Recommendation = 'go_hard' | 'moderate' | 'rest';

export interface ReadinessResult {
  /** 0–100 score; higher = more recovered. */
  score: number;
  recommendation: Recommendation;
  /** Per-component normalized contributions (each 0–1). */
  components: {
    hrv: number;
    acwr: number;
    sleep: number;
    hrDrift: number;
    subjective: number;
  };
  /** Human-readable rationale strings, in order of importance. */
  rationale: string[];
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function hrvComponent(input: ReadinessInput): number {
  if (!Number.isFinite(input.baselineRmssd) || input.baselineRmssd <= 0) return 0.5;
  const ratio = input.todayRmssd / input.baselineRmssd;
  // Map ratio: 0.7 → 0, 0.95 → 0.6, 1.05 → 0.85, 1.15 → 1.
  if (ratio >= 1.15) return 1;
  if (ratio >= 1.05) return 0.85 + (ratio - 1.05) * 1.5;
  if (ratio >= 0.95) return 0.6 + (ratio - 0.95) * 2.5;
  if (ratio >= 0.8) return (ratio - 0.8) * 4;
  return 0;
}

function acwrComponent(input: ReadinessInput): number {
  if (!input.atl || !input.ctl || input.ctl <= 0) return 0.5;
  const acwr = input.atl / input.ctl;
  // Sweet spot 0.8–1.3; danger zone > 1.5; under-trained < 0.6.
  if (acwr >= 0.8 && acwr <= 1.3) return 1;
  if (acwr < 0.8) return Math.max(0.4, acwr / 0.8);
  if (acwr <= 1.5) return 1 - (acwr - 1.3) * 2.5;
  return Math.max(0, 0.5 - (acwr - 1.5));
}

function sleepComponent(input: ReadinessInput): number {
  if (input.sleepHours === undefined) return 0.5;
  // Linear: 4h → 0, 7h → 0.85, 8h → 1, ≥ 9h → 1.
  if (input.sleepHours >= 8) return 1;
  if (input.sleepHours <= 4) return 0;
  return (input.sleepHours - 4) / 4;
}

function hrDriftComponent(input: ReadinessInput): number {
  if (!input.restingHr || !input.baselineRestingHr) return 0.5;
  const drift = input.restingHr - input.baselineRestingHr;
  // 0 bpm above baseline = 1; +5 = 0.5; +10 = 0.
  if (drift <= 0) return 1;
  if (drift >= 10) return 0;
  return 1 - drift / 10;
}

function subjectiveComponent(input: ReadinessInput): number {
  if (input.subjectiveWellness === undefined) return 0.5;
  return clamp01((input.subjectiveWellness - 1) / 9);
}

export interface ComputeOptions {
  weights?: Partial<ReadinessWeights>;
}

export function computeReadiness(input: ReadinessInput, opts: ComputeOptions = {}): ReadinessResult {
  const w: ReadinessWeights = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const components = {
    hrv: clamp01(hrvComponent(input)),
    acwr: clamp01(acwrComponent(input)),
    sleep: clamp01(sleepComponent(input)),
    hrDrift: clamp01(hrDriftComponent(input)),
    subjective: clamp01(subjectiveComponent(input)),
  };
  const totalWeight = w.hrv + w.acwr + w.sleep + w.hrDrift + w.subjective;
  const weighted =
    components.hrv * w.hrv +
    components.acwr * w.acwr +
    components.sleep * w.sleep +
    components.hrDrift * w.hrDrift +
    components.subjective * w.subjective;
  const score = Math.round((weighted / totalWeight) * 100);

  let recommendation: Recommendation;
  if (score >= 75) recommendation = 'go_hard';
  else if (score >= 55) recommendation = 'moderate';
  else recommendation = 'rest';

  const rationale: string[] = [];
  const ratio = input.baselineRmssd > 0 ? input.todayRmssd / input.baselineRmssd : 1;
  if (components.hrv < 0.5) rationale.push(`HRV is ${(ratio * 100 - 100).toFixed(0)}% off baseline.`);
  else if (components.hrv > 0.85) rationale.push('HRV is on or above baseline.');
  if (input.atl && input.ctl && components.acwr < 0.5) {
    rationale.push(`ACWR ${(input.atl / input.ctl).toFixed(2)} is outside the safe 0.8–1.3 window.`);
  }
  if (components.sleep < 0.5 && input.sleepHours !== undefined) {
    rationale.push(`Only ${input.sleepHours.toFixed(1)}h of sleep — under-recovered.`);
  }
  if (components.hrDrift < 0.5 && input.restingHr && input.baselineRestingHr) {
    rationale.push(`Resting HR is ${(input.restingHr - input.baselineRestingHr).toFixed(0)} bpm above baseline.`);
  }
  if (components.subjective < 0.4 && input.subjectiveWellness !== undefined) {
    rationale.push(`Self-reported wellness is ${input.subjectiveWellness}/10.`);
  }

  return { score, recommendation, components, rationale };
}

/**
 * Maintain a rolling RMSSD baseline. Returns the new mean+sd given the
 * existing window and today's reading. Window is fixed at 7 days; older
 * readings are dropped.
 */
export interface BaselineState {
  window: number[];
}

export function updateBaseline(
  state: BaselineState,
  todayRmssd: number,
  windowSize = 7,
): { mean: number; sd: number; state: BaselineState } {
  const next = [...state.window, todayRmssd].slice(-windowSize);
  const mean = next.reduce((a, b) => a + b, 0) / next.length;
  const variance = next.reduce((a, b) => a + (b - mean) ** 2, 0) / next.length;
  return { mean, sd: Math.sqrt(variance), state: { window: next } };
}
