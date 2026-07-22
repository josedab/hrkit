import { analyzeSession, HRV_POOR_RECOVERY, HRV_WELL_RECOVERED, type Session, type SessionAnalysis } from '@hrkit/core';

type Zone = 1 | 2 | 3 | 4 | 5;
export type SessionIntensity = 'easy' | 'moderate' | 'hard' | 'very hard';

const MODERATE_TRIMP_MIN = 30;
const HARD_TRIMP_MIN = 80;
const VERY_HARD_TRIMP_MIN = 150;
const HEAVY_LOAD_RATIO = 1.5;
const LIGHT_LOAD_RATIO = 0.5;
const HIGH_ZONE_FIVE_SHARE = 0.3;
const MIN_AEROBIC_SHARE = 0.5;
const HIGH_ARTIFACT_RATE = 0.1;
const MAX_RECOMMENDATIONS = 5;

export interface CoachInput {
  /** The session to analyze. */
  session: Session;
  /** Optional baseline rMSSD (ms) — enables recovery commentary. */
  baselineRmssd?: number;
  /** Optional list of recent training-load values for ACWR-aware advice. */
  recentTrimps?: number[];
  /** Optional context the user types in ("how do I feel today"). */
  userNote?: string;
}

export interface CoachOutput {
  /** One-line summary suitable for a notification. */
  headline: string;
  /** 3–6 sentence narrative summary. */
  summary: string;
  /** Up to 5 short bullet recommendations. */
  recommendations: string[];
  /** Top dominant zone (1–5). */
  dominantZone: Zone;
  /** Numerical analysis embedded for downstream use. */
  analysis: SessionAnalysis;
  /** Source: 'rule-engine' or LLM provider name. */
  source: string;
}

export interface RecoverySignal {
  message: string;
  belowBaseline: boolean;
}

export function classifyIntensity(trimp: number): SessionIntensity {
  if (trimp < MODERATE_TRIMP_MIN) return 'easy';
  if (trimp < HARD_TRIMP_MIN) return 'moderate';
  if (trimp < VERY_HARD_TRIMP_MIN) return 'hard';
  return 'very hard';
}

export function assessRecovery(rmssd: number | undefined, baselineRmssd: number | undefined): RecoverySignal {
  if (rmssd === undefined || baselineRmssd === undefined || !(baselineRmssd > 0)) {
    return { message: '', belowBaseline: false };
  }

  const ratio = rmssd / baselineRmssd;
  if (ratio >= HRV_WELL_RECOVERED) {
    return {
      message: 'HRV is at or above your baseline — recovery looks strong.',
      belowBaseline: false,
    };
  }
  if (ratio >= HRV_POOR_RECOVERY) {
    return {
      message: 'HRV is slightly below baseline — moderate sessions only today.',
      belowBaseline: true,
    };
  }
  return {
    message: 'HRV is well below baseline — prioritise rest or very easy aerobic work.',
    belowBaseline: true,
  };
}

function findDominantZone(zones: SessionAnalysis['zones']['zones']): Zone {
  const zone = Object.entries(zones).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '1';
  return Number.parseInt(zone, 10) as Zone;
}

function describeLoad(trimp: number, recentTrimps: number[] | undefined): string {
  if (!recentTrimps || recentTrimps.length === 0) return '';

  const average = recentTrimps.reduce((sum, value) => sum + value, 0) / recentTrimps.length;
  if (trimp > average * HEAVY_LOAD_RATIO) {
    return 'This session is significantly harder than your recent average.';
  }
  if (trimp < average * LIGHT_LOAD_RATIO) {
    return 'A lighter session compared to your recent average — good for recovery.';
  }
  return '';
}

function buildRecommendations(
  analysis: SessionAnalysis,
  intensity: SessionIntensity,
  recovery: RecoverySignal,
): string[] {
  const zones = analysis.zones.zones;
  const totalSec = analysis.zones.total;
  const recommendations: string[] = [];

  if (intensity === 'very hard' && (!recovery.message || recovery.belowBaseline)) {
    recommendations.push('Keep tomorrow easy or take a rest day.');
  }
  if (zones[5] > totalSec * HIGH_ZONE_FIVE_SHARE) {
    recommendations.push('Consider keeping zone 5 work to <20% of total time to reduce overtraining risk.');
  }
  if (zones[1] + zones[2] < totalSec * MIN_AEROBIC_SHARE && intensity !== 'easy') {
    recommendations.push('Add more zone 1–2 volume across the week to build aerobic base.');
  }
  if (analysis.artifacts && analysis.artifacts.artifactRate > HIGH_ARTIFACT_RATE) {
    recommendations.push('Artifact rate is high — check sensor contact / strap moisture.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Solid session. Stay consistent and protect your easy days.');
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Generate a coaching summary purely from rules — no network, no LLM.
 * Always returns a sensible, conservative response.
 */
export function ruleEngineSummary(input: CoachInput): CoachOutput {
  const analysis = analyzeSession(input.session);
  const dominantZone = findDominantZone(analysis.zones.zones);
  const minutes = Math.round(analysis.zones.total / 60);
  const intensity = classifyIntensity(analysis.trimp);
  const recovery = assessRecovery(analysis.hrv?.rmssd, input.baselineRmssd);
  const loadContext = describeLoad(analysis.trimp, input.recentTrimps);

  const headline = `${minutes}-min ${intensity} session · TRIMP ${Math.round(analysis.trimp)}`;
  const summary = [
    `You logged ${minutes} minutes with an average HR around zone ${dominantZone}.`,
    `Training impulse came in at ${Math.round(analysis.trimp)}, which counts as ${intensity}.`,
    analysis.hrv ? `Session HRV (rMSSD) was ${Math.round(analysis.hrv.rmssd)} ms.` : '',
    recovery.message,
    loadContext,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    headline,
    summary,
    recommendations: buildRecommendations(analysis, intensity, recovery),
    dominantZone,
    analysis,
    source: 'rule-engine',
  };
}
