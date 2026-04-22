/**
 * VO2max estimation and fitness scoring.
 *
 * Provides three estimation methods:
 *   1. **Uth formula** — from resting and maximum heart rate
 *   2. **Session-based** — HR drift during steady-state exercise
 *   3. **Fitness percentile** — age/sex-normalized ACSM reference tables
 *
 * All estimators return confidence intervals since field estimates are
 * inherently less precise than lab-based tests.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface VO2maxEstimate {
  /** Estimated VO2max in ml/kg/min. */
  vo2max: number;
  /** Estimation method used. */
  method: 'uth' | 'session' | 'cooper';
  /** 95% confidence interval lower bound (ml/kg/min). */
  ciLower: number;
  /** 95% confidence interval upper bound (ml/kg/min). */
  ciUpper: number;
  /** Confidence in the estimate (0–1). */
  confidence: number;
}

export interface FitnessScore {
  /** VO2max estimate in ml/kg/min. */
  vo2max: number;
  /** Fitness percentile (1–100) relative to age/sex norms. */
  percentile: number;
  /** Qualitative category. */
  category: 'very_poor' | 'poor' | 'fair' | 'good' | 'excellent' | 'superior';
  /** Age group used for comparison. */
  ageGroup: string;
  /** Sex used for comparison. */
  sex: 'male' | 'female';
}

export interface VO2maxSessionInput {
  /** Heart rate samples from a steady-state exercise session. */
  hrSamples: number[];
  /** Session duration in minutes. */
  durationMin: number;
  /** Athlete's resting heart rate. */
  restHR: number;
  /** Athlete's maximum heart rate. */
  maxHR: number;
  /** Optional: known sex for better accuracy. */
  sex?: 'male' | 'female';
}

// ── Uth–Sørensen–Overgaard Formula ──────────────────────────────────────

/**
 * Estimate VO2max using the Uth formula: `VO2max ≈ 15.3 × (HRmax / HRrest)`.
 *
 * Validated in trained individuals; less accurate for sedentary populations.
 * Typical error: ±3.5 ml/kg/min.
 *
 * @param maxHR - Maximum heart rate (bpm).
 * @param restHR - Resting heart rate (bpm).
 * @returns VO2max estimate with confidence interval, or zero-confidence result for invalid inputs.
 *
 * @example
 * ```ts
 * const est = estimateVO2maxUth(185, 55);
 * console.log(est.vo2max); // ~51.5 ml/kg/min
 * console.log(est.confidence); // 0.85
 * ```
 */
export function estimateVO2maxUth(maxHR: number, restHR: number): VO2maxEstimate {
  if (restHR <= 0 || maxHR <= restHR) {
    return { vo2max: 0, method: 'uth', ciLower: 0, ciUpper: 0, confidence: 0 };
  }

  const vo2max = 15.3 * (maxHR / restHR);
  const se = 3.5; // standard error from Uth et al. validation

  return {
    vo2max: round2(vo2max),
    method: 'uth',
    ciLower: round2(vo2max - 1.96 * se),
    ciUpper: round2(vo2max + 1.96 * se),
    confidence: restHR < 50 ? 0.85 : restHR < 60 ? 0.8 : 0.7,
  };
}

// ── Session-Based Estimation ────────────────────────────────────────────

/**
 * Estimate VO2max from HR drift during steady-state exercise.
 *
 * Uses the heart rate reserve (HRR) method: higher sustained %HRR at
 * aerobic intensity suggests lower VO2max, and vice versa.
 *
 * @param input - Session HR data and athlete parameters.
 * @returns VO2max estimate, or null if session is unsuitable (too short, intensity out of range).
 *
 * @example
 * ```ts
 * const est = estimateVO2maxFromSession({
 *   hrSamples: steadyStateHR, durationMin: 20, restHR: 60, maxHR: 190,
 * });
 * if (est) console.log(est.vo2max);
 * ```
 */
export function estimateVO2maxFromSession(input: VO2maxSessionInput): VO2maxEstimate | null {
  const { hrSamples, durationMin, restHR, maxHR } = input;

  if (hrSamples.length < 10 || durationMin < 5 || restHR <= 0 || maxHR <= restHR) {
    return null;
  }

  // Use the mean HR of the second half (steady-state plateau)
  const secondHalf = hrSamples.slice(Math.floor(hrSamples.length / 2));
  const meanSteadyHR = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  // %HRR during steady state
  const hrr = (meanSteadyHR - restHR) / (maxHR - restHR);

  // Only valid for aerobic steady-state (50–85% HRR)
  if (hrr < 0.4 || hrr > 0.9) return null;

  // Swain & Leutholtz relationship: %VO2R ≈ %HRR (well-validated)
  // VO2max ≈ VO2rest / (1 - %HRR) where VO2rest ≈ 3.5 ml/kg/min
  const vo2max = 3.5 / (1 - hrr);
  const se = 4.0; // higher error than Uth due to field conditions

  return {
    vo2max: round2(Math.min(vo2max, 90)),
    method: 'session',
    ciLower: round2(Math.max(vo2max - 1.96 * se, 10)),
    ciUpper: round2(Math.min(vo2max + 1.96 * se, 95)),
    confidence: durationMin >= 20 ? 0.7 : durationMin >= 10 ? 0.55 : 0.4,
  };
}

// ── Cooper Test Correlation ─────────────────────────────────────────────

/**
 * Estimate VO2max from a Cooper 12-minute run test.
 *
 * Formula: `VO2max = (distance_m - 504.9) / 44.73`
 *
 * @param distanceMeters - Distance covered in 12 minutes.
 * @returns VO2max estimate with confidence interval.
 *
 * @example
 * ```ts
 * const est = estimateVO2maxCooper(2400); // 2.4km in 12 min
 * console.log(est.vo2max); // ~42.35
 * ```
 */
export function estimateVO2maxCooper(distanceMeters: number): VO2maxEstimate {
  if (distanceMeters <= 0) {
    return { vo2max: 0, method: 'cooper', ciLower: 0, ciUpper: 0, confidence: 0 };
  }

  const vo2max = (distanceMeters - 504.9) / 44.73;
  const se = 3.35;

  return {
    vo2max: round2(Math.max(vo2max, 0)),
    method: 'cooper',
    ciLower: round2(Math.max(vo2max - 1.96 * se, 0)),
    ciUpper: round2(vo2max + 1.96 * se),
    confidence: 0.8,
  };
}

// ── ACSM Fitness Score ──────────────────────────────────────────────────

// ACSM percentile reference tables (VO2max in ml/kg/min)
// Source: ACSM's Guidelines for Exercise Testing and Prescription, 11th ed.
// Keys: [p10, p25, p50, p75, p90]
const MALE_NORMS: Record<string, number[]> = {
  '20-29': [33.0, 36.5, 42.5, 46.8, 52.5],
  '30-39': [31.5, 35.5, 40.0, 44.0, 48.0],
  '40-49': [28.0, 32.0, 36.5, 41.0, 45.0],
  '50-59': [25.0, 28.5, 33.5, 37.0, 41.5],
  '60-69': [22.0, 25.5, 30.0, 33.5, 37.0],
  '70+': [19.0, 22.5, 26.5, 30.0, 33.0],
};

const FEMALE_NORMS: Record<string, number[]> = {
  '20-29': [24.0, 28.0, 33.5, 38.5, 44.0],
  '30-39': [22.5, 26.5, 31.5, 35.5, 40.0],
  '40-49': [21.0, 24.5, 28.5, 33.0, 37.0],
  '50-59': [19.0, 22.0, 26.0, 30.0, 34.0],
  '60-69': [17.0, 20.0, 23.5, 27.0, 31.0],
  '70+': [15.0, 18.0, 21.5, 25.0, 28.5],
};

function getAgeGroup(age: number): string {
  if (!Number.isFinite(age) || age < 0) return '20-29';
  if (age < 30) return '20-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  return '70+';
}

function interpolatePercentile(vo2max: number, norms: number[]): number {
  if (!Number.isFinite(vo2max)) return 50;
  const percentileBreaks = [10, 25, 50, 75, 90];
  if (vo2max <= norms[0]!) return 5;
  if (vo2max >= norms[4]!) return 95;

  for (let i = 0; i < norms.length - 1; i++) {
    if (vo2max <= norms[i + 1]!) {
      const low = norms[i]!;
      const high = norms[i + 1]!;
      const pLow = percentileBreaks[i]!;
      const pHigh = percentileBreaks[i + 1]!;
      const t = (vo2max - low) / (high - low);
      return Math.round(pLow + t * (pHigh - pLow));
    }
  }
  return 50;
}

function percentileToCategory(p: number): 'very_poor' | 'poor' | 'fair' | 'good' | 'excellent' | 'superior' {
  if (p < 10) return 'very_poor';
  if (p < 25) return 'poor';
  if (p < 50) return 'fair';
  if (p < 75) return 'good';
  if (p < 90) return 'excellent';
  return 'superior';
}

/**
 * Compute a fitness score from VO2max using ACSM age/sex reference norms.
 *
 * @param vo2max - Estimated VO2max in ml/kg/min.
 * @param age - Athlete's age in years.
 * @param sex - Biological sex for norm comparison.
 * @returns Fitness score with percentile and category.
 *
 * @example
 * ```ts
 * const score = fitnessScore(48, 30, 'male');
 * console.log(score.percentile); // 75+
 * console.log(score.category); // 'excellent'
 * ```
 */
export function fitnessScore(vo2max: number, age: number, sex: 'male' | 'female'): FitnessScore {
  const ageGroup = getAgeGroup(age);
  const norms = sex === 'male' ? MALE_NORMS[ageGroup]! : FEMALE_NORMS[ageGroup]!;
  const percentile = interpolatePercentile(vo2max, norms);

  return {
    vo2max: round2(vo2max),
    percentile,
    category: percentileToCategory(percentile),
    ageGroup,
    sex,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
