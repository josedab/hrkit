import type { CoachInput } from './index.js';

/**
 * A workout recommendation produced by a `RecommenderPort` strategy.
 * Designed to be small, displayable, and dataset-independent so the same
 * shape is returned by deterministic rules and (future) ML models.
 */
export interface WorkoutRecommendation {
  /** Short canonical workout type. */
  workout: 'rest' | 'recovery' | 'steady' | 'tempo' | 'interval' | 'race-prep';
  /** Recommended duration in minutes (0 for rest). */
  durationMin: number;
  /** Target zone (1–5). 0 means "rest, no target". */
  targetZone: 0 | 1 | 2 | 3 | 4 | 5;
  /** Optional structured intervals (work/rest seconds, repeats). */
  intervals?: { workSec: number; restSec: number; repeats: number };
  /** 0–1 confidence the strategy has in this recommendation. */
  confidence: number;
  /** Why this was chosen — one line, displayable to the user. */
  rationale: string;
}

/**
 * Pluggable recommender contract. Multiple strategies can be registered and
 * compared (see `evalRecommender`); apps can also wrap an LLM behind this.
 */
export interface RecommenderPort {
  readonly id: string;
  recommend(input: CoachInput): WorkoutRecommendation;
}

// ── Built-in deterministic strategies ──────────────────────────────────

/**
 * Conservative recovery-first strategy. Always favours rest when fatigue
 * markers are present. Good default for general-population apps.
 */
export const recoveryFirstRecommender: RecommenderPort = {
  id: 'recovery-first-v1',
  recommend(input) {
    const fatigueRatio = computeFatigueRatio(input);
    if (fatigueRatio < 0.8) {
      return {
        workout: 'rest',
        durationMin: 0,
        targetZone: 0,
        confidence: 0.85,
        rationale: 'rMSSD well below baseline — rest day to allow parasympathetic recovery.',
      };
    }
    if (fatigueRatio < 0.95) {
      return {
        workout: 'recovery',
        durationMin: 30,
        targetZone: 1,
        confidence: 0.75,
        rationale: 'rMSSD moderately depressed — easy aerobic work only.',
      };
    }
    return {
      workout: 'steady',
      durationMin: 45,
      targetZone: 2,
      confidence: 0.6,
      rationale: 'Recovery markers OK — steady aerobic session.',
    };
  },
};

/**
 * Performance-leaning strategy. Pushes harder when HRV is good and recent
 * load (ACWR) is below 1.3.
 */
export const performanceRecommender: RecommenderPort = {
  id: 'performance-v1',
  recommend(input) {
    const fatigueRatio = computeFatigueRatio(input);
    const acwr = computeAcwr(input.recentTrimps ?? []);
    if (fatigueRatio < 0.85) {
      return {
        workout: 'recovery',
        durationMin: 25,
        targetZone: 1,
        confidence: 0.7,
        rationale: 'HRV suppressed — back off even on a performance plan.',
      };
    }
    if (acwr > 1.4) {
      return {
        workout: 'steady',
        durationMin: 40,
        targetZone: 2,
        confidence: 0.65,
        rationale: `ACWR ${acwr.toFixed(2)} elevated — keep it aerobic.`,
      };
    }
    if (fatigueRatio >= 1.0 && acwr < 1.0) {
      return {
        workout: 'interval',
        durationMin: 50,
        targetZone: 4,
        intervals: { workSec: 240, restSec: 120, repeats: 5 },
        confidence: 0.8,
        rationale: 'HRV strong and load light — VO₂ session indicated.',
      };
    }
    return {
      workout: 'tempo',
      durationMin: 45,
      targetZone: 3,
      confidence: 0.7,
      rationale: 'Solid recovery — threshold-adjacent tempo.',
    };
  },
};

/**
 * Polarised 80/20 strategy. Returns mostly easy work with one quality day
 * per microcycle (heuristically: when recent TRIMP entries are low).
 */
export const polarisedRecommender: RecommenderPort = {
  id: 'polarised-80-20-v1',
  recommend(input) {
    const recent = input.recentTrimps ?? [];
    const hardDaysRecent = recent.filter((t) => t > 100).length;
    const fatigueRatio = computeFatigueRatio(input);

    if (fatigueRatio < 0.85) {
      return {
        workout: 'rest',
        durationMin: 0,
        targetZone: 0,
        confidence: 0.9,
        rationale: 'Recovery first — polarised plan still defers to HRV.',
      };
    }
    if (hardDaysRecent === 0 && recent.length >= 3) {
      return {
        workout: 'interval',
        durationMin: 55,
        targetZone: 5,
        intervals: { workSec: 180, restSec: 180, repeats: 6 },
        confidence: 0.8,
        rationale: 'No hard sessions in recent history — quality day scheduled.',
      };
    }
    return {
      workout: 'steady',
      durationMin: 60,
      targetZone: 2,
      confidence: 0.85,
      rationale: 'Easy day — bulk of the 80% in the polarised distribution.',
    };
  },
};

// ── Evaluation harness ──────────────────────────────────────────────────

export interface RecommenderEvalCase {
  name: string;
  input: CoachInput;
  /** Set of acceptable workout types (strategies disagree by design). */
  acceptable: WorkoutRecommendation['workout'][];
}

export interface RecommenderEvalResult {
  recommenderId: string;
  passed: number;
  failed: number;
  total: number;
  failures: Array<{ caseName: string; got: string; acceptable: string[] }>;
}

/**
 * Run a recommender against a fixture corpus and report pass/fail. Used in
 * CI to guard against regression when adding new strategies or tweaking
 * thresholds. Strategies are NOT expected to all pass every case — this
 * harness is per-strategy.
 */
export function evalRecommender(recommender: RecommenderPort, cases: RecommenderEvalCase[]): RecommenderEvalResult {
  const failures: RecommenderEvalResult['failures'] = [];
  for (const c of cases) {
    const got = recommender.recommend(c.input);
    if (!c.acceptable.includes(got.workout)) {
      failures.push({ caseName: c.name, got: got.workout, acceptable: c.acceptable });
    }
  }
  return {
    recommenderId: recommender.id,
    total: cases.length,
    failed: failures.length,
    passed: cases.length - failures.length,
    failures,
  };
}

// ── Internal helpers ────────────────────────────────────────────────────

function computeFatigueRatio(input: CoachInput): number {
  // SessionAnalysis.hrv is the *current* rMSSD; baselineRmssd is the rolling 7d.
  // We avoid running analyzeSession again — accept that callers may pass it.
  const baseline = input.baselineRmssd;
  if (!baseline || baseline <= 0) return 1;
  // Cheap rmssd-from-session: average RR jitter. We re-derive instead of
  // depending on analyzeSession() to keep the recommender path zero-cost.
  const rr = input.session.rrIntervals;
  if (rr.length < 2) return 1;
  let sum = 0;
  for (let i = 1; i < rr.length; i++) {
    const a = rr[i] ?? 0;
    const b = rr[i - 1] ?? 0;
    const d = a - b;
    sum += d * d;
  }
  const today = Math.sqrt(sum / (rr.length - 1));
  return today / baseline;
}

function computeAcwr(trimps: number[]): number {
  if (trimps.length < 7) return 1;
  const acute = trimps.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const chronic = trimps.slice(-28).reduce((a, b) => a + b, 0) / Math.min(28, trimps.length);
  return chronic === 0 ? 1 : acute / chronic;
}
