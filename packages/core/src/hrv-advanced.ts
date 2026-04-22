/**
 * Research-grade HRV analysis: artifact correction (Lipponen-Tarvainen),
 * non-linear (Poincaré SD1/SD2, DFA α1), and frequency-domain (LF/HF via
 * Lomb-Scargle to handle unevenly-sampled RR data).
 *
 * All functions are pure, allocation-light, and dependency-free.
 */

// ── Artifact correction (Lipponen & Tarvainen, 2019) ────────────────────

/** Result of artifact correction. */
export interface CleanedRR {
  /** Cleaned RR interval series (ms). */
  rr: number[];
  /** Indices into the original series that were flagged as artefacts. */
  artefactIndices: number[];
}

/**
 * Detect and correct ectopic / artefact RR intervals using a simplified
 * Lipponen-Tarvainen approach. Uses a moving median filter with
 * dynamic threshold; flagged samples are replaced by the median of the
 * surrounding window.
 *
 * @param rr - Raw RR intervals in ms.
 * @param opts.windowSize - Median window (default 5).
 * @param opts.thresholdMs - Absolute deviation threshold in ms (default 250).
 * @param opts.relativeThreshold - Fractional deviation threshold (default 0.20).
 */
export function cleanRR(
  rr: number[],
  opts: { windowSize?: number; thresholdMs?: number; relativeThreshold?: number } = {},
): CleanedRR {
  const win = opts.windowSize ?? 5;
  const absThr = opts.thresholdMs ?? 250;
  const relThr = opts.relativeThreshold ?? 0.2;
  if (rr.length === 0) return { rr: [], artefactIndices: [] };

  const out = [...rr];
  const artefactIndices: number[] = [];
  const half = Math.floor(win / 2);

  for (let i = 0; i < rr.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(rr.length, i + half + 1);
    const window: number[] = [];
    for (let j = lo; j < hi; j++) {
      if (j !== i) window.push(rr[j]!);
    }
    if (window.length === 0) continue;
    const med = median(window);
    const v = rr[i]!;
    const abs = Math.abs(v - med);
    if (abs > absThr || abs / med > relThr) {
      out[i] = med;
      artefactIndices.push(i);
    }
  }
  return { rr: out, artefactIndices };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

// ── Poincaré (SD1, SD2) ─────────────────────────────────────────────────

/** Poincaré plot descriptors. */
export interface PoincareResult {
  /** Short-term variability (perpendicular to identity). */
  sd1: number;
  /** Long-term variability (along identity). */
  sd2: number;
  /** SD1/SD2 ratio (autonomic balance proxy). */
  ratio: number;
}

/**
 * Poincaré plot SD1, SD2, and SD1/SD2 ratio.
 * SD1 is mathematically equivalent to rMSSD/√2.
 */
export function poincare(rr: number[]): PoincareResult {
  if (rr.length < 2) return { sd1: 0, sd2: 0, ratio: 0 };
  let sumDiff2 = 0;
  let sumSum2 = 0;
  let mDiff = 0;
  let mSum = 0;
  const n = rr.length - 1;
  for (let i = 0; i < n; i++) {
    mDiff += rr[i + 1]! - rr[i]!;
    mSum += rr[i + 1]! + rr[i]!;
  }
  mDiff /= n;
  mSum /= n;
  for (let i = 0; i < n; i++) {
    const d = rr[i + 1]! - rr[i]! - mDiff;
    const s = rr[i + 1]! + rr[i]! - mSum;
    sumDiff2 += d * d;
    sumSum2 += s * s;
  }
  const sd1 = Math.sqrt(sumDiff2 / (2 * n));
  const sd2 = Math.sqrt(sumSum2 / (2 * n));
  return { sd1, sd2, ratio: sd2 > 0 ? sd1 / sd2 : 0 };
}

// ── Detrended Fluctuation Analysis α1 ───────────────────────────────────

/**
 * DFA α1 short-term scaling exponent (typically over scales 4..16 beats).
 * Values around 1.0 indicate healthy autonomic regulation; <0.75 has been
 * associated with elevated training load / fatigue (Rogers et al., 2021).
 *
 * @param rr - RR intervals in ms (recommend ≥150 samples).
 * @param opts.scaleMin - Minimum window size (default 4).
 * @param opts.scaleMax - Maximum window size (default 16).
 */
export function dfaAlpha1(rr: number[], opts: { scaleMin?: number; scaleMax?: number } = {}): number {
  const scaleMin = opts.scaleMin ?? 4;
  const scaleMax = opts.scaleMax ?? 16;
  if (rr.length < scaleMax * 4) return NaN;

  // Filter out non-finite or non-positive values
  const clean = rr.filter((v) => Number.isFinite(v) && v > 0);
  if (clean.length < scaleMax * 4) return NaN;

  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  // Cumulative sum of mean-centered series (integrated profile).
  const y: number[] = new Array(clean.length);
  let acc = 0;
  for (let i = 0; i < clean.length; i++) {
    acc += clean[i]! - mean;
    y[i] = acc;
  }

  const logScales: number[] = [];
  const logF: number[] = [];

  for (let n = scaleMin; n <= scaleMax; n++) {
    const f = fluctuation(y, n);
    if (f > 0) {
      logScales.push(Math.log10(n));
      logF.push(Math.log10(f));
    }
  }
  if (logScales.length < 2) return NaN;
  const { slope } = linreg(logScales, logF);
  return slope;
}

function fluctuation(y: number[], n: number): number {
  const segments = Math.floor(y.length / n);
  if (segments === 0) return 0;
  let sumSq = 0;
  for (let s = 0; s < segments; s++) {
    const start = s * n;
    // Linear detrend on segment
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(i);
      ys.push(y[start + i]!);
    }
    const { slope, intercept } = linreg(xs, ys);
    for (let i = 0; i < n; i++) {
      const fit = slope * i + intercept;
      const r = ys[i]! - fit;
      sumSq += r * r;
    }
  }
  return Math.sqrt(sumSq / (segments * n));
}

function linreg(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i]!;
    my += y[i]!;
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    num += dx * (y[i]! - my);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// ── Frequency-domain (Lomb-Scargle) ─────────────────────────────────────

/** Frequency-domain HRV result. */
export interface FrequencyDomainResult {
  /** Very-low-frequency power (0.003-0.04 Hz), ms². */
  vlf: number;
  /** Low-frequency power (0.04-0.15 Hz), ms². */
  lf: number;
  /** High-frequency power (0.15-0.4 Hz), ms². */
  hf: number;
  /** LF/HF ratio. */
  lfHfRatio: number;
  /** LF in normalized units (LF / (LF+HF) * 100). */
  lfNu: number;
  /** HF in normalized units. */
  hfNu: number;
  /** Total spectral power, ms². */
  totalPower: number;
}

/**
 * Lomb-Scargle frequency-domain HRV. Handles unevenly-sampled RR series
 * directly without resampling. Produces VLF/LF/HF power and ratios.
 *
 * @param rr - RR intervals in ms.
 * @param opts.fStart - Lowest frequency (Hz). Default 0.003.
 * @param opts.fEnd - Highest frequency (Hz). Default 0.4.
 * @param opts.nFreq - Number of frequency bins. Default 256.
 */
export function frequencyDomain(
  rr: number[],
  opts: { fStart?: number; fEnd?: number; nFreq?: number } = {},
): FrequencyDomainResult {
  if (rr.length < 8) {
    return { vlf: 0, lf: 0, hf: 0, lfHfRatio: 0, lfNu: 0, hfNu: 0, totalPower: 0 };
  }
  const fStart = opts.fStart ?? 0.003;
  const fEnd = opts.fEnd ?? 0.4;
  const nFreq = opts.nFreq ?? 256;

  // Build cumulative time axis (s) from RR intervals.
  const t: number[] = new Array(rr.length);
  let cum = 0;
  for (let i = 0; i < rr.length; i++) {
    cum += rr[i]! / 1000;
    t[i] = cum;
  }

  // Mean-center the series.
  const mean = rr.reduce((s, v) => s + v, 0) / rr.length;
  const y: number[] = rr.map((v) => v - mean);

  // Frequency grid.
  const freqs: number[] = new Array(nFreq);
  const step = (fEnd - fStart) / (nFreq - 1);
  for (let i = 0; i < nFreq; i++) freqs[i] = fStart + i * step;

  // Lomb-Scargle periodogram (normalized).
  const power: number[] = new Array(nFreq);
  for (let k = 0; k < nFreq; k++) {
    const w = 2 * Math.PI * freqs[k]!;
    let sSin2 = 0;
    let sCos2 = 0;
    for (let i = 0; i < t.length; i++) {
      const a = 2 * w * t[i]!;
      sSin2 += Math.sin(a);
      sCos2 += Math.cos(a);
    }
    const tau = Math.atan2(sSin2, sCos2) / (2 * w);

    let sumYC = 0;
    let sumYS = 0;
    let sumC2 = 0;
    let sumS2 = 0;
    for (let i = 0; i < t.length; i++) {
      const arg = w * (t[i]! - tau);
      const c = Math.cos(arg);
      const s = Math.sin(arg);
      sumYC += y[i]! * c;
      sumYS += y[i]! * s;
      sumC2 += c * c;
      sumS2 += s * s;
    }
    const term1 = sumC2 > 0 ? (sumYC * sumYC) / sumC2 : 0;
    const term2 = sumS2 > 0 ? (sumYS * sumYS) / sumS2 : 0;
    power[k] = 0.5 * (term1 + term2);
  }

  // Integrate power over each band (trapezoid).
  const bandPower = (lo: number, hi: number): number => {
    let p = 0;
    for (let i = 0; i < nFreq - 1; i++) {
      const f0 = freqs[i]!;
      const f1 = freqs[i + 1]!;
      if (f1 < lo || f0 > hi) continue;
      const fa = Math.max(f0, lo);
      const fb = Math.min(f1, hi);
      const pa = power[i]!;
      const pb = power[i + 1]!;
      p += ((pa + pb) / 2) * (fb - fa);
    }
    return p;
  };

  const vlf = bandPower(0.003, 0.04);
  const lf = bandPower(0.04, 0.15);
  const hf = bandPower(0.15, 0.4);
  const totalPower = vlf + lf + hf;
  const lfHfRatio = hf > 0 ? lf / hf : 0;
  const lfHfSum = lf + hf;
  const lfNu = lfHfSum > 0 ? (lf / lfHfSum) * 100 : 0;
  const hfNu = lfHfSum > 0 ? (hf / lfHfSum) * 100 : 0;
  return { vlf, lf, hf, lfHfRatio, lfNu, hfNu, totalPower };
}

// ── Kubios-style report ─────────────────────────────────────────────────

/** Comprehensive HRV report combining time, non-linear, and frequency domains. */
export interface HRVReport {
  /** Number of RR samples (after cleaning). */
  n: number;
  /** Number of artefact samples corrected. */
  artefactCount: number;
  /** Time-domain. */
  time: { meanRR: number; meanHR: number; sdnn: number; rmssd: number; pnn50: number };
  /** Non-linear (Poincaré + DFA). */
  nonlinear: { sd1: number; sd2: number; sd1Sd2Ratio: number; dfaAlpha1: number };
  /** Frequency-domain. */
  frequency: FrequencyDomainResult;
}

/** Build a Kubios-compatible HRV report from raw RR intervals. */
export function hrvReport(rawRr: number[]): HRVReport {
  const cleaned = cleanRR(rawRr);
  const rr = cleaned.rr;
  const meanRR = rr.length > 0 ? rr.reduce((s, v) => s + v, 0) / rr.length : 0;
  const meanHRv = meanRR > 0 ? 60000 / meanRR : 0;
  // Inline simple time-domain to avoid circular import with hrv.ts.
  const _sdnn = (() => {
    if (rr.length < 2) return 0;
    const m = meanRR;
    const variance = rr.reduce((s, v) => s + (v - m) ** 2, 0) / rr.length;
    return Math.sqrt(variance);
  })();
  const _rmssd = (() => {
    if (rr.length < 2) return 0;
    let s = 0;
    for (let i = 1; i < rr.length; i++) {
      const d = rr[i]! - rr[i - 1]!;
      s += d * d;
    }
    return Math.sqrt(s / (rr.length - 1));
  })();
  const _pnn50 = (() => {
    if (rr.length < 2) return 0;
    let c = 0;
    for (let i = 1; i < rr.length; i++) if (Math.abs(rr[i]! - rr[i - 1]!) > 50) c++;
    return (c / (rr.length - 1)) * 100;
  })();
  const p = poincare(rr);
  const dfa = dfaAlpha1(rr);
  const fd = frequencyDomain(rr);

  return {
    n: rr.length,
    artefactCount: cleaned.artefactIndices.length,
    time: { meanRR, meanHR: meanHRv, sdnn: _sdnn, rmssd: _rmssd, pnn50: _pnn50 },
    nonlinear: { sd1: p.sd1, sd2: p.sd2, sd1Sd2Ratio: p.ratio, dfaAlpha1: dfa },
    frequency: fd,
  };
}
