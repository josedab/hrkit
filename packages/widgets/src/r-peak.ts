/**
 * Pan-Tompkins-inspired R-peak detection.
 *
 * Pure utility — does not require DOM. Used by `<hrkit-ecg-strip>` and
 * exposable as a low-level building block for HRV pipelines.
 *
 * Pipeline:
 *   1. Bandpass approximation (5–15 Hz) using cascaded high/low-pass IIRs.
 *   2. Derivative.
 *   3. Squaring.
 *   4. Moving-window integration (~150 ms).
 *   5. Adaptive thresholding with refractory period (~200 ms).
 */

export interface RPeakResult {
  /** Indices into the input signal where R-peaks were detected. */
  peakIndices: number[];
  /** Detected RR intervals in milliseconds (peak-to-peak). */
  rrIntervals: number[];
}

export interface RPeakOptions {
  /** ECG sampling rate in Hz. Default 130 (Polar H10). */
  fs?: number;
  /** Refractory period in seconds (no peaks within this window). Default 0.2. */
  refractorySec?: number;
}

/** Detect R-peaks using Pan-Tompkins-style processing. */
export function detectRPeaks(signal: number[], opts: RPeakOptions = {}): RPeakResult {
  const fs = opts.fs ?? 130;
  const refractory = Math.floor((opts.refractorySec ?? 0.2) * fs);
  if (signal.length < fs * 0.5) return { peakIndices: [], rrIntervals: [] };

  // Step 1: simple bandpass via low-pass + high-pass (1st-order IIR each).
  const lp = lowPass(signal, fs, 15);
  const bp = highPass(lp, fs, 5);

  // Step 2: derivative (centered)
  const dx = new Array<number>(bp.length).fill(0);
  for (let i = 2; i < bp.length - 2; i++) {
    dx[i] = (2 * bp[i + 2]! + bp[i + 1]! - bp[i - 1]! - 2 * bp[i - 2]!) / 8;
  }

  // Step 3: squaring
  const sq = dx.map((v) => v * v);

  // Step 4: moving window integration (~150 ms)
  const winSize = Math.max(3, Math.floor(0.15 * fs));
  const integ = movingAverage(sq, winSize);

  // Step 5: adaptive thresholding
  // Initial threshold from first ~2 s of data
  const initEnd = Math.min(integ.length, Math.floor(fs * 2));
  let spki = 0; // running peak estimate of signal
  let npki = 0; // running peak estimate of noise
  for (let i = 0; i < initEnd; i++) spki = Math.max(spki, integ[i]!);
  spki *= 0.25;
  npki = spki * 0.5;

  const peaks: number[] = [];
  let lastPeak = -refractory;

  for (let i = 1; i < integ.length - 1; i++) {
    const v = integ[i]!;
    if (v > integ[i - 1]! && v > integ[i + 1]!) {
      const threshold = npki + 0.25 * (spki - npki);
      if (v > threshold && i - lastPeak > refractory) {
        peaks.push(i);
        lastPeak = i;
        spki = 0.125 * v + 0.875 * spki;
      } else {
        npki = 0.125 * v + 0.875 * npki;
      }
    }
  }

  const rr: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rr.push(((peaks[i]! - peaks[i - 1]!) / fs) * 1000);
  }
  return { peakIndices: peaks, rrIntervals: rr };
}

function lowPass(x: number[], fs: number, fc: number): number[] {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / fs;
  const a = dt / (rc + dt);
  const out = new Array<number>(x.length).fill(0);
  out[0] = x[0]!;
  for (let i = 1; i < x.length; i++) out[i] = out[i - 1]! + a * (x[i]! - out[i - 1]!);
  return out;
}

function highPass(x: number[], fs: number, fc: number): number[] {
  const rc = 1 / (2 * Math.PI * fc);
  const dt = 1 / fs;
  const a = rc / (rc + dt);
  const out = new Array<number>(x.length).fill(0);
  out[0] = x[0]!;
  for (let i = 1; i < x.length; i++) out[i] = a * (out[i - 1]! + x[i]! - x[i - 1]!);
  return out;
}

function movingAverage(x: number[], win: number): number[] {
  const out = new Array<number>(x.length).fill(0);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i]!;
    if (i >= win) sum -= x[i - win]!;
    out[i] = sum / Math.min(i + 1, win);
  }
  return out;
}
