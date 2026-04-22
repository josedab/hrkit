/**
 * Cuffless blood pressure estimation from pulse transit time (PTT).
 *
 * Estimates systolic and diastolic blood pressure from the time delay
 * between ECG R-peak and peripheral pulse arrival (PPG peak). Requires
 * per-user calibration against a known cuff reading.
 *
 * ⚠️ NOT A MEDICAL DEVICE. Estimates are for wellness/trend tracking
 * only and must not be used for clinical decisions.
 *
 * Reference: Mukkamala et al., "Toward Ubiquitous Blood Pressure
 * Monitoring via Pulse Transit Time", IEEE TBME, 2015.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface BPEstimate {
  /** Estimated systolic blood pressure (mmHg). */
  systolic: number;
  /** Estimated diastolic blood pressure (mmHg). */
  diastolic: number;
  /** Mean arterial pressure (mmHg). */
  map: number;
  /** Pulse transit time used (ms). */
  ptt: number;
  /** Confidence in the estimate (0–1). */
  confidence: number;
  /** Whether calibration was used. */
  calibrated: boolean;
  /** Timestamp of the estimate. */
  timestamp: number;
  /** Medical disclaimer. */
  disclaimer: string;
}

export interface BPCalibration {
  /** Known systolic BP from cuff measurement (mmHg). */
  systolic: number;
  /** Known diastolic BP from cuff measurement (mmHg). */
  diastolic: number;
  /** PTT measured at time of calibration (ms). */
  ptt: number;
  /** When the calibration was taken. */
  timestamp: number;
}

export interface PTTInput {
  /** ECG R-peak timestamps in ms. */
  rPeakTimestamps: number[];
  /** PPG pulse arrival timestamps in ms (same timebase as R-peaks). */
  ppgPeakTimestamps: number[];
}

const BP_DISCLAIMER =
  'Blood pressure estimates are for wellness and trend tracking ONLY. ' +
  'This is NOT a medical device and cannot replace clinical BP measurement. ' +
  'Consult a healthcare professional for medical decisions.';

// ── Physiological Constants ─────────────────────────────────────────────

/** Minimum physiological pulse transit time in ms. */
const PTT_MIN_MS = 50;
/** Maximum physiological pulse transit time in ms. */
const PTT_MAX_MS = 500;
/** Systolic BP physiological clamp range (mmHg). */
const SBP_CLAMP: [number, number] = [70, 220];
/** Diastolic BP physiological clamp range (mmHg). */
const DBP_CLAMP: [number, number] = [40, 130];

// ── PTT Extraction ──────────────────────────────────────────────────────

/**
 * Extract pulse transit times from aligned ECG R-peaks and PPG peaks.
 *
 * For each R-peak, finds the closest subsequent PPG peak within a
 * physiological window (50–500ms). Returns the array of valid PTT values.
 *
 * @param input - R-peak and PPG peak timestamps (must share the same timebase).
 * @returns Array of PTT values in milliseconds. Empty if no valid pairs found.
 *
 * @example
 * ```ts
 * const ptts = extractPTT({
 *   rPeakTimestamps: ecgRPeaks,
 *   ppgPeakTimestamps: ppgPulseArrivals,
 * });
 * const bp = estimateBloodPressure(ptts, calibration);
 * ```
 */
export function extractPTT(input: PTTInput): number[] {
  const { rPeakTimestamps, ppgPeakTimestamps } = input;
  if (rPeakTimestamps.length === 0 || ppgPeakTimestamps.length === 0) return [];

  const ptts: number[] = [];
  let ppgIdx = 0;

  for (const rPeak of rPeakTimestamps) {
    // Advance PPG index to find first peak after this R-peak
    while (ppgIdx < ppgPeakTimestamps.length && ppgPeakTimestamps[ppgIdx]! <= rPeak) {
      ppgIdx++;
    }
    if (ppgIdx >= ppgPeakTimestamps.length) break;

    const ptt = ppgPeakTimestamps[ppgIdx]! - rPeak;

    // Physiological PTT range: 50–500ms
    if (ptt >= PTT_MIN_MS && ptt <= PTT_MAX_MS) {
      ptts.push(Math.round(ptt * 100) / 100);
    }
  }

  return ptts;
}

/**
 * Compute median of an array of numbers.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

// ── BP Estimation Models ────────────────────────────────────────────────

// Default model: log-linear PTT-to-BP (Mukkamala-inspired)
// SBP = a * ln(PTT) + b, where coefficients are calibration-derived
const DEFAULT_SBP_A = -60;
const DEFAULT_SBP_B = 400;
const DEFAULT_DBP_A = -35;
const DEFAULT_DBP_B = 250;

/**
 * Estimate blood pressure from a single PTT value using uncalibrated model.
 */
function estimateUncalibrated(ptt: number): { systolic: number; diastolic: number } {
  const lnPTT = Math.log(ptt);
  const systolic = Math.round(DEFAULT_SBP_A * lnPTT + DEFAULT_SBP_B);
  const diastolic = Math.round(DEFAULT_DBP_A * lnPTT + DEFAULT_DBP_B);
  return {
    systolic: clamp(systolic, SBP_CLAMP[0], SBP_CLAMP[1]),
    diastolic: clamp(diastolic, DBP_CLAMP[0], DBP_CLAMP[1]),
  };
}

/**
 * Estimate blood pressure using calibrated model.
 *
 * Applies a linear offset from the calibration point:
 * SBP_est = SBP_default(PTT) + (SBP_cal - SBP_default(PTT_cal))
 */
function estimateCalibrated(ptt: number, cal: BPCalibration): { systolic: number; diastolic: number } {
  const defaultAtCal = estimateUncalibrated(cal.ptt);
  const defaultAtPTT = estimateUncalibrated(ptt);

  const sysOffset = cal.systolic - defaultAtCal.systolic;
  const diaOffset = cal.diastolic - defaultAtCal.diastolic;

  return {
    systolic: clamp(Math.round(defaultAtPTT.systolic + sysOffset), SBP_CLAMP[0], SBP_CLAMP[1]),
    diastolic: clamp(Math.round(defaultAtPTT.diastolic + diaOffset), DBP_CLAMP[0], DBP_CLAMP[1]),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Main API ────────────────────────────────────────────────────────────

/**
 * Estimate blood pressure from pulse transit time.
 *
 * @param ptts - Array of PTT values in ms (use {@link extractPTT} to compute).
 * @param calibration - Optional calibration from a known cuff reading. Improves accuracy significantly.
 * @returns Blood pressure estimate with confidence interval, or null if input is empty or out of range.
 *
 * @example
 * ```ts
 * const bp = estimateBloodPressure(ptts, {
 *   systolic: 120, diastolic: 80, ptt: 200, timestamp: Date.now(),
 * });
 * if (bp) console.log(`${bp.systolic}/${bp.diastolic} mmHg`);
 * ```
 */
export function estimateBloodPressure(ptts: number[], calibration?: BPCalibration): BPEstimate | null {
  if (ptts.length === 0) return null;

  const medianPTT = median(ptts);
  if (medianPTT < PTT_MIN_MS || medianPTT > PTT_MAX_MS) return null;

  const hasCalibration = calibration != null && calibration.ptt > 0;
  const { systolic, diastolic } = hasCalibration
    ? estimateCalibrated(medianPTT, calibration!)
    : estimateUncalibrated(medianPTT);

  // Mean arterial pressure: MAP ≈ DBP + 1/3(SBP - DBP)
  const map = Math.round(diastolic + (systolic - diastolic) / 3);

  // Confidence based on data quality
  let confidence = 0.3; // base for uncalibrated
  if (hasCalibration) confidence = 0.6;
  if (ptts.length >= 20) confidence += 0.1;
  if (ptts.length >= 50) confidence += 0.1;

  // Penalize high PTT variance
  const mean = ptts.reduce((s, v) => s + v, 0) / ptts.length;
  const cv =
    ptts.length > 1 && mean > 0 ? Math.sqrt(ptts.reduce((s, v) => s + (v - mean) ** 2, 0) / ptts.length) / mean : 0;
  if (cv > 0.15) confidence -= 0.1;

  confidence = Math.round(Math.max(0.1, Math.min(0.85, confidence)) * 100) / 100;

  return {
    systolic,
    diastolic,
    map,
    ptt: Math.round(medianPTT * 10) / 10,
    confidence,
    calibrated: hasCalibration,
    timestamp: Date.now(),
    disclaimer: BP_DISCLAIMER,
  };
}
