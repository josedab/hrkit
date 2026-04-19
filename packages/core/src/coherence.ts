/**
 * HRV biofeedback / coherence — quantifies how well an athlete's RR rhythm is
 * locked to a target breathing frequency (default 0.1 Hz, the classic
 * resonance frequency for adult vagal tone training).
 *
 * Coherence (HeartMath-inspired definition): the fraction of total spectral
 * power within a narrow band around the target frequency. Higher = more
 * "in the zone". Range 0..1.
 */

export interface CoherenceOptions {
  /** Target resonance frequency in Hz. Default 0.1 (≈ 6 breaths/min). */
  targetHz?: number;
  /** Half-width of the coherence band, Hz. Default 0.015 (so 0.085–0.115). */
  bandHz?: number;
}

export interface CoherenceResult {
  /** Coherence score 0..1 (peak-band power / total LF+HF power). */
  score: number;
  /** Power inside the resonance band. */
  bandPower: number;
  /** Total LF+HF power (denominator). */
  totalPower: number;
  /** Frequency at which spectrum peaked. */
  peakHz: number;
  /** True if peakHz falls inside the resonance band. */
  inBand: boolean;
}

/**
 * Compute a coherence score for a window of RR intervals.
 *
 * Returns score = 0 if the window is too short (< 30 RR samples) or has
 * zero spectral power. Suitable for sliding-window real-time use:
 * call every 5–10 s with the most recent 60–120 s of RR.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @param opts - Optional target frequency and band width.
 * @returns Coherence result with score (0–1), band/total power, and peak frequency.
 *
 * @example
 * ```ts
 * const result = coherenceScore(recentRR, { targetHz: 0.1 });
 * console.log(`Coherence: ${(result.score * 100).toFixed(0)}%`);
 * if (result.inBand) console.log('Breathing at resonance frequency!');
 * ```
 */
export function coherenceScore(rr: number[], opts: CoherenceOptions = {}): CoherenceResult {
  const target = opts.targetHz ?? 0.1;
  const halfBand = opts.bandHz ?? 0.015;

  if (rr.length < 30) {
    return { score: 0, bandPower: 0, totalPower: 0, peakHz: 0, inBand: false };
  }

  // Build a fine frequency grid around the LF/HF range.
  const grid: number[] = [];
  // 0.04..0.4 Hz at 0.005 Hz resolution
  for (let f = 0.04; f <= 0.4 + 1e-9; f += 0.005) grid.push(f);

  // Inline Lomb-Scargle on the fine grid (cheap; we need raw periodogram amplitudes).
  const t: number[] = [0];
  for (let i = 1; i < rr.length; i++) t.push(t[i - 1]! + (rr[i - 1] ?? 0) / 1000);
  const mean = rr.reduce((s, v) => s + v, 0) / rr.length;
  const detrended = rr.map((v) => v - mean);

  let peakHz = 0;
  let peakP = -Infinity;
  let totalP = 0;
  let bandP = 0;
  for (const f of grid) {
    const w = 2 * Math.PI * f;
    let cs = 0,
      ss = 0;
    for (let i = 0; i < t.length; i++) {
      cs += Math.cos(2 * w * t[i]!);
      ss += Math.sin(2 * w * t[i]!);
    }
    const tau = Math.atan2(ss, cs) / (2 * w);
    let cc = 0,
      ssum = 0,
      xc = 0,
      xs = 0;
    for (let i = 0; i < t.length; i++) {
      const arg = w * (t[i]! - tau);
      const c = Math.cos(arg);
      const s = Math.sin(arg);
      cc += c * c;
      ssum += s * s;
      xc += detrended[i]! * c;
      xs += detrended[i]! * s;
    }
    const power = 0.5 * ((cc > 0 ? (xc * xc) / cc : 0) + (ssum > 0 ? (xs * xs) / ssum : 0));
    totalP += power;
    if (Math.abs(f - target) <= halfBand) bandP += power;
    if (power > peakP) {
      peakP = power;
      peakHz = f;
    }
  }

  const score = totalP > 0 ? Math.min(1, bandP / totalP) : 0;
  return {
    score,
    bandPower: bandP,
    totalPower: totalP,
    peakHz,
    inBand: Math.abs(peakHz - target) <= halfBand,
  };
}

/**
 * Suggested breathing cadence (breaths-per-minute) for a given resonance
 * frequency. 0.1 Hz → 6 bpm, 0.083 Hz → 5 bpm, 0.117 Hz → 7 bpm.
 *
 * @param hz - Frequency in Hertz.
 * @returns Breaths per minute.
 *
 * @example
 * ```ts
 * const bpm = bpmFromHz(0.1); // 6 breaths/min
 * ```
 */
export function bpmFromHz(hz: number): number {
  return hz * 60;
}
