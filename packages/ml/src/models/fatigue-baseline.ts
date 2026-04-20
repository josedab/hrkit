import type { InferencePort } from '../index.js';

export interface FatigueInput {
  /** Recent rMSSD readings (ms), oldest → newest. */
  rmssdSeries: number[];
  /** Resting HR samples (bpm) over same period. */
  restingHrSeries: number[];
}

export interface FatigueOutput {
  /** 0 = fresh, 1 = severe fatigue. */
  score: number;
  band: 'fresh' | 'normal' | 'fatigued' | 'high';
  notes: string[];
}

/**
 * Deterministic fatigue baseline: combines downward rMSSD trend (parasympathetic
 * suppression) with elevated resting HR (sympathetic load). No ML weights —
 * a transparent linear blend so consumers see exactly why a score was assigned.
 */
export const fatigueBaseline: InferencePort<FatigueInput, FatigueOutput> = {
  modelId: 'fatigue-baseline',
  version: '1.0.0',
  modalities: ['hrv', 'hr'],
  intendedUse: 'wellness',
  async predict({ rmssdSeries, restingHrSeries }) {
    const notes: string[] = [];
    if (rmssdSeries.length < 3 || restingHrSeries.length < 3) {
      return { score: 0, band: 'fresh', notes: ['insufficient history'] };
    }

    const rmssdSlope = linearSlope(rmssdSeries);
    const hrSlope = linearSlope(restingHrSeries);
    const rmssdBaseline = mean(rmssdSeries.slice(0, Math.min(5, rmssdSeries.length)));
    const rmssdLatest = rmssdSeries[rmssdSeries.length - 1] ?? rmssdBaseline;
    const rmssdDelta = rmssdBaseline > 0 ? (rmssdLatest - rmssdBaseline) / rmssdBaseline : 0;

    const rmssdComponent = clamp(-rmssdDelta * 1.5, 0, 1);
    const hrComponent = clamp(hrSlope / 2, 0, 1);
    const score = clamp(0.65 * rmssdComponent + 0.35 * hrComponent, 0, 1);

    if (rmssdSlope < -0.5) notes.push('rMSSD trending down');
    if (hrSlope > 0.5) notes.push('resting HR trending up');

    const band: FatigueOutput['band'] =
      score < 0.2 ? 'fresh' : score < 0.45 ? 'normal' : score < 0.7 ? 'fatigued' : 'high';

    return { score, band, notes };
  },
};

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function linearSlope(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const xbar = (n - 1) / 2;
  const ybar = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xbar;
    num += dx * ((xs[i] ?? 0) - ybar);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
