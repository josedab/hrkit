// ── ACWR Thresholds ─────────────────────────────────────────────────────
/** ACWR above this value indicates critical injury risk. */
const ACWR_CRITICAL = 1.5;
/** ACWR above this value indicates elevated risk. */
const ACWR_HIGH = 1.3;
/** ACWR below this value indicates undertrained state. */
const ACWR_UNDERTRAINED = 0.8;

// ── HRV Analysis Thresholds ────────────────────────────────────────────
/** Minimum HRV change (%) to be classified as improving/declining vs stable. */
const HRV_CHANGE_THRESHOLD = 5;
/** Minimum consecutive declining days to flag concern. */
const HRV_CONCERN_STREAK = 3;

// ── Training Load Thresholds ───────────────────────────────────────────
/** Monotony above this value suggests too little training variation. */
const MONOTONY_HIGH = 2.0;
/** TSB below this value suggests a deload is needed. */
const TSB_DELOAD_THRESHOLD = -20;

// ── HRV Baseline Thresholds ───────────────────────────────────────────
/** HRV ratio below this vs baseline indicates poor recovery. */
const HRV_POOR_RECOVERY = 0.8;
/** HRV ratio above this vs baseline indicates well recovered. */
const HRV_WELL_RECOVERED = 0.95;

// ── Rolling Window Sizes ──────────────────────────────────────────────
/** Number of recent days used for HRV trend analysis. */
const HRV_TREND_WINDOW = 7;
/** Number of recent days used for monotony calculation. */
const MONOTONY_WINDOW = 7;

export {
  ACWR_CRITICAL,
  ACWR_HIGH,
  ACWR_UNDERTRAINED,
  HRV_POOR_RECOVERY,
  HRV_WELL_RECOVERED,
  MONOTONY_HIGH,
  TSB_DELOAD_THRESHOLD,
};

/** Training recommendation verdict. */
export type TrainingVerdict = 'go_hard' | 'moderate' | 'easy' | 'rest' | 'deload';

/** Risk level for overtraining/injury. */
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

/** A zone prescription for the recommended workout. */
export interface ZonePrescription {
  /** Primary zone to target. */
  primaryZone: 1 | 2 | 3 | 4 | 5;
  /** Maximum zone to stay below. */
  maxZone: 1 | 2 | 3 | 4 | 5;
  /** Suggested duration in minutes. */
  suggestedDurationMin: number;
}

/** A single reasoning point explaining the recommendation. */
export interface InsightReason {
  /** Factor that influenced the recommendation. */
  factor: 'acwr' | 'hrv_trend' | 'hrv_baseline' | 'training_monotony' | 'freshness' | 'recovery';
  /** Human-readable explanation. */
  message: string;
  /** Whether this factor raised concern. */
  concern: boolean;
}

/** Complete training recommendation. */
export interface TrainingRecommendation {
  /** Overall training verdict. */
  verdict: TrainingVerdict;
  /** Injury/overtraining risk level. */
  riskLevel: RiskLevel;
  /** Suggested workout parameters. */
  prescription: ZonePrescription;
  /** Confidence in this recommendation (0-1). */
  confidence: number;
  /** Detailed reasoning for the recommendation. */
  reasons: InsightReason[];
  /** Summary message for display. */
  summary: string;
}

import type { HRVTrendPoint, TrainingLoadPoint } from './athlete-store.js';

export type { HRVTrendPoint, TrainingLoadPoint } from './athlete-store.js';

/** Input data for generating a training recommendation. */
export interface InsightInput {
  /** Recent training load data (should cover at least 28 days for best results). */
  trainingLoad: TrainingLoadPoint[];
  /** Recent HRV trend data (should cover at least 7 days). */
  hrvTrend: HRVTrendPoint[];
  /** Today's morning rMSSD reading. */
  todayRmssd?: number;
  /** 7-day baseline rMSSD. */
  baselineRmssd?: number;
  /** Athlete's max HR (for zone calculations). */
  maxHR: number;
  /** Athlete's resting HR. */
  restHR?: number;
}

const PRESCRIPTIONS: Record<TrainingVerdict, ZonePrescription> = {
  go_hard: { primaryZone: 4, maxZone: 5, suggestedDurationMin: 50 },
  moderate: { primaryZone: 3, maxZone: 4, suggestedDurationMin: 38 },
  easy: { primaryZone: 2, maxZone: 3, suggestedDurationMin: 25 },
  rest: { primaryZone: 1, maxZone: 2, suggestedDurationMin: 10 },
  deload: { primaryZone: 2, maxZone: 3, suggestedDurationMin: 25 },
};

/**
 * Assess injury risk from ACWR data.
 * ACWR < 0.8 = undertrained, 0.8-1.3 = sweet spot, 1.3-1.5 = caution, > 1.5 = danger.
 *
 * @param acwr - Acute:Chronic Workload Ratio.
 * @returns Risk level: 'low', 'moderate', 'high', or 'critical'.
 *
 * @example
 * ```ts
 * const risk = assessACWRRisk(1.4);
 * console.log(risk); // 'high'
 * ```
 */
export function assessACWRRisk(acwr: number): RiskLevel {
  if (acwr > ACWR_CRITICAL) return 'critical';
  if (acwr > ACWR_HIGH) return 'high';
  if (acwr >= ACWR_UNDERTRAINED) return 'low';
  return 'moderate'; // undertrained
}

/**
 * Analyze HRV trend for signs of fatigue or overtraining.
 * Declining rMSSD over 3+ days suggests accumulated fatigue.
 *
 * @param trend - Array of recent HRV trend data points.
 * @returns Direction ('improving' | 'stable' | 'declining'), magnitude (%), and whether it raises concern.
 *
 * @example
 * ```ts
 * const trend = analyzeHRVTrend(store.getHRVTrend());
 * if (trend.concern) console.warn('HRV declining — consider a rest day');
 * ```
 */
export function analyzeHRVTrend(trend: HRVTrendPoint[]): {
  direction: 'improving' | 'stable' | 'declining';
  magnitude: number;
  concern: boolean;
} {
  if (trend.length < 2) {
    return { direction: 'stable', magnitude: 0, concern: false };
  }

  const recent = trend.slice(-HRV_TREND_WINDOW);
  const firstAvg = recent[0]!.rollingAvg;
  const lastAvg = recent[recent.length - 1]!.rollingAvg;

  if (firstAvg === 0) {
    return { direction: 'stable', magnitude: 0, concern: false };
  }

  const changePercent = ((lastAvg - firstAvg) / firstAvg) * 100;
  const magnitude = Math.abs(changePercent);

  // Count consecutive declining days
  let decliningStreak = 0;
  for (let i = recent.length - 1; i >= 1; i--) {
    if (recent[i]!.rollingAvg < recent[i - 1]!.rollingAvg) {
      decliningStreak++;
    } else {
      break;
    }
  }

  let direction: 'improving' | 'stable' | 'declining';
  if (changePercent > HRV_CHANGE_THRESHOLD) {
    direction = 'improving';
  } else if (changePercent < -HRV_CHANGE_THRESHOLD) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }

  const concern = direction === 'declining' && decliningStreak >= HRV_CONCERN_STREAK;

  return { direction, magnitude, concern };
}

/**
 * Calculate training monotony (how repetitive training load is).
 * Monotony = mean daily TRIMP / stddev of daily TRIMP over 7 days.
 * Monotony > 2.0 suggests too little variation.
 *
 * @param trainingLoad - Recent training load data points.
 * @returns Monotony value. `Infinity` if all days have the same load. 0 if insufficient data.
 *
 * @example
 * ```ts
 * const mono = calculateMonotony(store.getTrainingLoadTrend());
 * if (mono > 2.0) console.warn('Training too repetitive — add variety');
 * ```
 */
export function calculateMonotony(trainingLoad: TrainingLoadPoint[]): number {
  const recent = trainingLoad.slice(-MONOTONY_WINDOW);
  if (recent.length < 2) return 0;

  const dailyLoads = recent.map((p) => p.atl);
  const mean = dailyLoads.reduce((s, v) => s + v, 0) / dailyLoads.length;

  const variance = dailyLoads.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyLoads.length;
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return Infinity;
  return mean / stddev;
}

/**
 * Generate a training recommendation based on training load and HRV data.
 * Uses rule-based analysis — no ML model required.
 *
 * @param input - Training load trend, HRV trend, and athlete profile data.
 * @returns Complete {@link TrainingRecommendation} with verdict, risk, prescription, and reasoning.
 *
 * @example
 * ```typescript
 * const rec = getTrainingRecommendation({
 *   trainingLoad: store.getTrainingLoadTrend(),
 *   hrvTrend: store.getHRVTrend(),
 *   todayRmssd: 42,
 *   baselineRmssd: 45,
 *   maxHR: 185,
 * });
 * console.log(rec.verdict, rec.summary);
 * ```
 */
export function getTrainingRecommendation(input: InsightInput): TrainingRecommendation {
  const reasons: InsightReason[] = [];
  const confidence = computeConfidence(input);

  // Assess each factor independently
  const acwrFactor = assessACWRFactor(input.trainingLoad, reasons);
  const hrvTrendFactor = assessHRVTrendFactor(input.hrvTrend, reasons);
  const hrvBaselineFactor = assessHRVBaselineFactor(input.todayRmssd, input.baselineRmssd, reasons);
  const monotonyFactor = assessMonotonyFactor(input.trainingLoad, reasons);
  const freshnessFactor = assessFreshnessFactor(input.trainingLoad, reasons);

  // Combine factors into final verdict
  const { verdict, riskLevel } = buildVerdict(
    acwrFactor,
    hrvTrendFactor,
    hrvBaselineFactor,
    monotonyFactor,
    freshnessFactor,
  );

  return {
    verdict,
    riskLevel,
    prescription: { ...PRESCRIPTIONS[verdict] },
    confidence,
    reasons,
    summary: buildSummary(verdict, acwrFactor.acwr, hrvTrendFactor.analysis, freshnessFactor.tsb),
  };
}

// ── Factor Assessment Helpers ───────────────────────────────────────────

interface ACWRFactor {
  acwr: number | null;
  risk: RiskLevel;
}

function computeConfidence(input: InsightInput): number {
  let confidence = 0.5;
  if (input.trainingLoad.length > 0) confidence += 0.1;
  if (input.hrvTrend.length > 0) confidence += 0.1;
  if (input.todayRmssd != null) confidence += 0.1;
  if (input.baselineRmssd != null) confidence += 0.1;
  return Math.min(confidence, 1.0);
}

function assessACWRFactor(trainingLoad: TrainingLoadPoint[], reasons: InsightReason[]): ACWRFactor {
  if (trainingLoad.length === 0) return { acwr: null, risk: 'low' };

  const acwr = trainingLoad[trainingLoad.length - 1]!.acwr;
  const risk = assessACWRRisk(acwr);

  if (acwr > ACWR_CRITICAL) {
    reasons.push({
      factor: 'acwr',
      message: `ACWR is critically high (${acwr.toFixed(1)}). Injury risk is elevated.`,
      concern: true,
    });
  } else if (acwr > ACWR_HIGH) {
    reasons.push({
      factor: 'acwr',
      message: `ACWR is elevated (${acwr.toFixed(1)}). Reduce training load.`,
      concern: true,
    });
  } else if (acwr >= ACWR_UNDERTRAINED) {
    reasons.push({ factor: 'acwr', message: `ACWR is in the sweet spot (${acwr.toFixed(1)}).`, concern: false });
  } else {
    reasons.push({
      factor: 'acwr',
      message: `ACWR is low (${acwr.toFixed(1)}). You may be undertrained.`,
      concern: false,
    });
  }

  return { acwr, risk };
}

interface HRVTrendFactor {
  analysis: ReturnType<typeof analyzeHRVTrend> | null;
}

function assessHRVTrendFactor(hrvTrend: HRVTrendPoint[], reasons: InsightReason[]): HRVTrendFactor {
  if (hrvTrend.length === 0) return { analysis: null };

  const analysis = analyzeHRVTrend(hrvTrend);

  if (analysis.concern) {
    reasons.push({
      factor: 'hrv_trend',
      message: `HRV has been declining (${analysis.magnitude.toFixed(0)}% drop). Accumulated fatigue likely.`,
      concern: true,
    });
  } else if (analysis.direction === 'declining') {
    reasons.push({
      factor: 'hrv_trend',
      message: `HRV is trending down (${analysis.magnitude.toFixed(0)}%).`,
      concern: true,
    });
  } else if (analysis.direction === 'improving') {
    reasons.push({
      factor: 'hrv_trend',
      message: `HRV is trending up (${analysis.magnitude.toFixed(0)}%). Recovery looks good.`,
      concern: false,
    });
  } else {
    reasons.push({ factor: 'hrv_trend', message: 'HRV is stable.', concern: false });
  }

  return { analysis };
}

interface HRVBaselineFactor {
  ratio: number | null;
}

function assessHRVBaselineFactor(
  todayRmssd: number | undefined,
  baselineRmssd: number | undefined,
  reasons: InsightReason[],
): HRVBaselineFactor {
  if (todayRmssd == null || baselineRmssd == null || baselineRmssd <= 0) return { ratio: null };

  const ratio = todayRmssd / baselineRmssd;

  if (ratio < HRV_POOR_RECOVERY) {
    reasons.push({
      factor: 'hrv_baseline',
      message: `Today's rMSSD is ${(ratio * 100).toFixed(0)}% of baseline. Recovery is poor.`,
      concern: true,
    });
  } else if (ratio >= HRV_WELL_RECOVERED) {
    reasons.push({
      factor: 'hrv_baseline',
      message: `Today's rMSSD is ${(ratio * 100).toFixed(0)}% of baseline. Well recovered.`,
      concern: false,
    });
  } else {
    reasons.push({
      factor: 'hrv_baseline',
      message: `Today's rMSSD is ${(ratio * 100).toFixed(0)}% of baseline.`,
      concern: false,
    });
  }

  return { ratio };
}

interface MonotonyFactor {
  value: number;
}

function assessMonotonyFactor(trainingLoad: TrainingLoadPoint[], reasons: InsightReason[]): MonotonyFactor {
  if (trainingLoad.length < 2) return { value: 0 };

  const monotony = calculateMonotony(trainingLoad);

  if (monotony > MONOTONY_HIGH && Number.isFinite(monotony)) {
    reasons.push({
      factor: 'training_monotony',
      message: `Training monotony is high (${monotony.toFixed(1)}). Add variety to your sessions.`,
      concern: true,
    });
  }

  return { value: monotony };
}

interface FreshnessFactor {
  tsb: number | null;
}

function assessFreshnessFactor(trainingLoad: TrainingLoadPoint[], reasons: InsightReason[]): FreshnessFactor {
  if (trainingLoad.length === 0) return { tsb: null };

  const tsb = trainingLoad[trainingLoad.length - 1]!.tsb;

  if (tsb < TSB_DELOAD_THRESHOLD) {
    reasons.push({
      factor: 'freshness',
      message: `Training stress balance is very negative (${tsb.toFixed(0)}). A deload is recommended.`,
      concern: true,
    });
  } else if (tsb > 0) {
    reasons.push({
      factor: 'freshness',
      message: `Positive training stress balance (${tsb.toFixed(0)}). You're fresh.`,
      concern: false,
    });
  }

  return { tsb };
}

// ── Verdict Builder ─────────────────────────────────────────────────────

function buildVerdict(
  acwr: ACWRFactor,
  hrv: HRVTrendFactor,
  baseline: HRVBaselineFactor,
  monotony: MonotonyFactor,
  freshness: FreshnessFactor,
): { verdict: TrainingVerdict; riskLevel: RiskLevel } {
  let verdict: TrainingVerdict = 'moderate';
  let riskLevel: RiskLevel = acwr.risk;

  // Critical ACWR overrides everything
  if (acwr.acwr != null && acwr.acwr > ACWR_CRITICAL) {
    return { verdict: 'rest', riskLevel: 'critical' };
  }
  if (acwr.acwr != null && acwr.acwr > ACWR_HIGH) {
    return { verdict: 'easy', riskLevel: 'high' };
  }

  // Deload when very fatigued
  if (freshness.tsb != null && freshness.tsb < TSB_DELOAD_THRESHOLD) {
    verdict = 'deload';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (hrv.analysis?.direction === 'declining' && acwr.acwr != null && acwr.acwr > 1.0) {
    verdict = 'easy';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (baseline.ratio != null && baseline.ratio < HRV_POOR_RECOVERY) {
    verdict = 'rest';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (monotony.value > MONOTONY_HIGH && Number.isFinite(monotony.value)) {
    verdict = 'easy';
  } else if (
    hrv.analysis?.direction === 'improving' &&
    acwr.acwr != null &&
    acwr.acwr >= ACWR_UNDERTRAINED &&
    acwr.acwr <= ACWR_HIGH
  ) {
    verdict = 'go_hard';
  } else if (
    acwr.acwr != null &&
    acwr.acwr < ACWR_UNDERTRAINED &&
    hrv.analysis &&
    (hrv.analysis.direction === 'stable' || hrv.analysis.direction === 'improving')
  ) {
    verdict = 'go_hard';
  } else if (baseline.ratio != null && baseline.ratio >= HRV_WELL_RECOVERED) {
    if (verdict === 'moderate') verdict = 'go_hard';
  }

  return { verdict, riskLevel };
}

function buildSummary(
  verdict: TrainingVerdict,
  acwr: number | null,
  hrvAnalysis: ReturnType<typeof analyzeHRVTrend> | null,
  tsb: number | null,
): string {
  switch (verdict) {
    case 'go_hard': {
      const parts = ['Ready to push hard.'];
      if (acwr != null) parts.push(`ACWR is in the sweet spot (${acwr.toFixed(1)})`);
      if (hrvAnalysis?.direction === 'improving') parts.push('and HRV is trending up.');
      else if (parts.length > 1) parts[parts.length - 1] += '.';
      return parts.join(' ');
    }
    case 'moderate':
      return 'Moderate effort today. Monitor how you feel and keep intensity controlled.';
    case 'easy': {
      const parts = ['Take it easy today.'];
      if (hrvAnalysis?.direction === 'declining') {
        parts.push(`HRV has been declining and`);
      }
      if (acwr != null && acwr > ACWR_HIGH) {
        parts.push(`ACWR is elevated (${acwr.toFixed(1)}).`);
      }
      return parts.join(' ');
    }
    case 'rest': {
      if (acwr != null && acwr > ACWR_CRITICAL) {
        return `Rest day recommended. High ACWR (${acwr.toFixed(1)}) indicates injury risk.`;
      }
      return 'Rest day recommended. Your body needs time to recover.';
    }
    case 'deload': {
      const msg = 'Deload week advised.';
      if (tsb != null) return `${msg} Training stress balance is very negative (${tsb.toFixed(0)}).`;
      return `${msg} Reduce volume and intensity to allow adaptation.`;
    }
  }
}
