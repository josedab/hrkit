import type { InferencePort } from '../index.js';

export interface LactateInput {
  /** HR/power samples. Order does not matter; the model sorts internally. */
  samples: Array<{ powerWatts: number; hr: number }>;
}

export interface LactateOutput {
  /** Estimated lactate-threshold power in watts (Conconi deflection). */
  ltWatts: number;
  /** Estimated lactate-threshold heart rate (bpm). */
  ltHr: number;
  /** R² of the linear fit below the deflection (0–1). */
  rSquared: number;
  /** Whether enough data was present to compute a confident estimate. */
  confident: boolean;
}

/**
 * Deterministic Conconi-style deflection-point estimator. Walks an HR vs power
 * sweep, fits a piecewise linear model, and returns the inflection where HR
 * decouples from power — a classical (pre-ML) lactate-threshold proxy.
 *
 * Not an ML model. Exists so consumers can wire the InferencePort surface and
 * later swap in a learned regressor without changing call sites.
 */
export const lactateThresholdBaseline: InferencePort<LactateInput, LactateOutput> = {
  modelId: 'lactate-threshold-baseline',
  version: '1.0.0',
  modalities: ['hr', 'power'],
  intendedUse: 'wellness',
  async predict({ samples }) {
    if (samples.length < 6) {
      return { ltWatts: 0, ltHr: 0, rSquared: 0, confident: false };
    }
    const sorted = [...samples].sort((a, b) => a.powerWatts - b.powerWatts);

    let bestIdx = -1;
    let bestR2 = -Infinity;
    for (let i = 4; i < sorted.length - 2; i++) {
      const lower = sorted.slice(0, i + 1);
      const r2 = rSquaredLinear(lower);
      if (r2 > bestR2) {
        bestR2 = r2;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return { ltWatts: 0, ltHr: 0, rSquared: 0, confident: false };
    const lt = sorted[bestIdx];
    if (!lt) return { ltWatts: 0, ltHr: 0, rSquared: 0, confident: false };
    return {
      ltWatts: lt.powerWatts,
      ltHr: lt.hr,
      rSquared: bestR2,
      confident: bestR2 >= 0.85 && samples.length >= 12,
    };
  },
};

function rSquaredLinear(pts: Array<{ powerWatts: number; hr: number }>): number {
  const n = pts.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sx += p.powerWatts;
    sy += p.hr;
    sxx += p.powerWatts * p.powerWatts;
    sxy += p.powerWatts * p.hr;
    syy += p.hr * p.hr;
  }
  const ssXX = sxx - (sx * sx) / n;
  const ssYY = syy - (sy * sy) / n;
  const ssXY = sxy - (sx * sy) / n;
  if (ssXX <= 0 || ssYY <= 0) return 0;
  const r = ssXY / Math.sqrt(ssXX * ssYY);
  return r * r;
}
