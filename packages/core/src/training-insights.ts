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
  let verdict: TrainingVerdict = 'moderate';
  let riskLevel: RiskLevel = 'low';

  // --- Confidence ---
  let confidence = 0.5;
  if (input.trainingLoad.length > 0) confidence += 0.1;
  if (input.hrvTrend.length > 0) confidence += 0.1;
  if (input.todayRmssd != null) confidence += 0.1;
  if (input.baselineRmssd != null) confidence += 0.1;
  confidence = Math.min(confidence, 1.0);

  // --- 1. ACWR ---
  let latestACWR: number | null = null;
  if (input.trainingLoad.length > 0) {
    latestACWR = input.trainingLoad[input.trainingLoad.length - 1]!.acwr;
    riskLevel = assessACWRRisk(latestACWR);

    if (latestACWR > ACWR_CRITICAL) {
      verdict = 'rest';
      reasons.push({
        factor: 'acwr',
        message: `ACWR is critically high (${latestACWR.toFixed(1)}). Injury risk is elevated.`,
        concern: true,
      });
    } else if (latestACWR > ACWR_HIGH) {
      verdict = 'easy';
      reasons.push({
        factor: 'acwr',
        message: `ACWR is elevated (${latestACWR.toFixed(1)}). Reduce training load.`,
        concern: true,
      });
    } else if (latestACWR >= ACWR_UNDERTRAINED) {
      reasons.push({
        factor: 'acwr',
        message: `ACWR is in the sweet spot (${latestACWR.toFixed(1)}).`,
        concern: false,
      });
    } else {
      reasons.push({
        factor: 'acwr',
        message: `ACWR is low (${latestACWR.toFixed(1)}). You may be undertrained.`,
        concern: false,
      });
    }
  }

  // --- 2. HRV trend ---
  let hrvAnalysis: ReturnType<typeof analyzeHRVTrend> | null = null;
  if (input.hrvTrend.length > 0) {
    hrvAnalysis = analyzeHRVTrend(input.hrvTrend);

    if (hrvAnalysis.concern) {
      reasons.push({
        factor: 'hrv_trend',
        message: `HRV has been declining (${hrvAnalysis.magnitude.toFixed(0)}% drop). Accumulated fatigue likely.`,
        concern: true,
      });
    } else if (hrvAnalysis.direction === 'declining') {
      reasons.push({
        factor: 'hrv_trend',
        message: `HRV is trending down (${hrvAnalysis.magnitude.toFixed(0)}%).`,
        concern: true,
      });
    } else if (hrvAnalysis.direction === 'improving') {
      reasons.push({
        factor: 'hrv_trend',
        message: `HRV is trending up (${hrvAnalysis.magnitude.toFixed(0)}%). Recovery looks good.`,
        concern: false,
      });
    } else {
      reasons.push({
        factor: 'hrv_trend',
        message: 'HRV is stable.',
        concern: false,
      });
    }
  }

  // --- 3. HRV vs baseline ---
  let hrvBaselineRatio: number | null = null;
  if (input.todayRmssd != null && input.baselineRmssd != null && input.baselineRmssd > 0) {
    hrvBaselineRatio = input.todayRmssd / input.baselineRmssd;

    if (hrvBaselineRatio < HRV_POOR_RECOVERY) {
      reasons.push({
        factor: 'hrv_baseline',
        message: `Today's rMSSD is ${(hrvBaselineRatio * 100).toFixed(0)}% of baseline. Recovery is poor.`,
        concern: true,
      });
    } else if (hrvBaselineRatio >= HRV_WELL_RECOVERED) {
      reasons.push({
        factor: 'hrv_baseline',
        message: `Today's rMSSD is ${(hrvBaselineRatio * 100).toFixed(0)}% of baseline. Well recovered.`,
        concern: false,
      });
    } else {
      reasons.push({
        factor: 'hrv_baseline',
        message: `Today's rMSSD is ${(hrvBaselineRatio * 100).toFixed(0)}% of baseline.`,
        concern: false,
      });
    }
  }

  // --- 4. Monotony ---
  let monotony = 0;
  if (input.trainingLoad.length >= 2) {
    monotony = calculateMonotony(input.trainingLoad);

    if (monotony > MONOTONY_HIGH && Number.isFinite(monotony)) {
      reasons.push({
        factor: 'training_monotony',
        message: `Training monotony is high (${monotony.toFixed(1)}). Add variety to your sessions.`,
        concern: true,
      });
    }
  }

  // --- 5. Freshness (TSB) ---
  let latestTSB: number | null = null;
  if (input.trainingLoad.length > 0) {
    latestTSB = input.trainingLoad[input.trainingLoad.length - 1]!.tsb;

    if (latestTSB < TSB_DELOAD_THRESHOLD) {
      reasons.push({
        factor: 'freshness',
        message: `Training stress balance is very negative (${latestTSB.toFixed(0)}). A deload is recommended.`,
        concern: true,
      });
    } else if (latestTSB > 0) {
      reasons.push({
        factor: 'freshness',
        message: `Positive training stress balance (${latestTSB.toFixed(0)}). You're fresh.`,
        concern: false,
      });
    }
  }

  // --- Combine factors into final verdict ---
  // Critical ACWR overrides everything
  if (latestACWR != null && latestACWR > ACWR_CRITICAL) {
    verdict = 'rest';
    riskLevel = 'critical';
  } else if (latestACWR != null && latestACWR > ACWR_HIGH) {
    verdict = 'easy';
    riskLevel = 'high';
  } else if (latestTSB != null && latestTSB < TSB_DELOAD_THRESHOLD) {
    // Deload when very fatigued
    verdict = 'deload';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (hrvAnalysis && hrvAnalysis.direction === 'declining' && latestACWR != null && latestACWR > 1.0) {
    // HRV declining with above-average load
    verdict = 'easy';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (hrvBaselineRatio != null && hrvBaselineRatio < HRV_POOR_RECOVERY) {
    // Poor recovery based on today's HRV
    verdict = 'rest';
    riskLevel = riskLevel === 'low' ? 'moderate' : riskLevel;
  } else if (monotony > MONOTONY_HIGH && Number.isFinite(monotony)) {
    // High monotony → deload/easy
    verdict = 'easy';
  } else if (
    hrvAnalysis &&
    hrvAnalysis.direction === 'improving' &&
    latestACWR != null &&
    latestACWR >= ACWR_UNDERTRAINED &&
    latestACWR <= ACWR_HIGH
  ) {
    // Sweet spot + improving HRV → go hard
    verdict = 'go_hard';
  } else if (
    latestACWR != null &&
    latestACWR < ACWR_UNDERTRAINED &&
    hrvAnalysis &&
    (hrvAnalysis.direction === 'stable' || hrvAnalysis.direction === 'improving')
  ) {
    // Undertrained but ready
    verdict = 'go_hard';
  } else if (hrvBaselineRatio != null && hrvBaselineRatio >= HRV_WELL_RECOVERED) {
    // Well recovered → supports pushing harder
    if (verdict === 'moderate') verdict = 'go_hard';
  }

  // --- Build prescription ---
  const prescription = { ...PRESCRIPTIONS[verdict] };

  // --- Build summary ---
  const summary = buildSummary(verdict, latestACWR, hrvAnalysis, latestTSB);

  return {
    verdict,
    riskLevel,
    prescription,
    confidence,
    reasons,
    summary,
  };
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
