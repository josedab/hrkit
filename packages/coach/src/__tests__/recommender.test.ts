import type { Session } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import {
  type CoachInput,
  evalRecommender,
  performanceRecommender,
  polarisedRecommender,
  recoveryFirstRecommender,
} from '../index.js';

function buildSession(rrs: number[]): Session {
  return {
    schemaVersion: 1,
    startTime: 0,
    endTime: 1000,
    samples: [{ timestamp: 0, hr: 60 }],
    rrIntervals: rrs,
    rounds: [],
    config: { maxHR: 190, restHR: 60, zones: [0.6, 0.7, 0.8, 0.9] },
  };
}

const goodHrvInput: CoachInput = {
  session: buildSession([1000, 1010, 990, 1005, 998, 1003, 1001, 999, 1002]),
  baselineRmssd: 8,
  recentTrimps: [40, 50, 45, 55, 48, 60, 50],
};

const poorHrvInput: CoachInput = {
  session: buildSession([1000, 1100, 900, 1050, 950, 1100, 920, 1080]),
  baselineRmssd: 200, // makes today/baseline very low
  recentTrimps: [40, 50, 45, 55, 48, 60, 50],
};

const overreachedInput: CoachInput = {
  session: buildSession([1000, 1005, 1000, 1003, 1001]),
  baselineRmssd: 4,
  recentTrimps: [200, 220, 210, 230, 240, 220, 250],
};

describe('recoveryFirstRecommender', () => {
  it('rests when HRV is depressed', () => {
    const r = recoveryFirstRecommender.recommend(poorHrvInput);
    expect(r.workout).toBe('rest');
    expect(r.targetZone).toBe(0);
  });
  it('does not push hard even with great HRV', () => {
    const r = recoveryFirstRecommender.recommend(goodHrvInput);
    expect(['steady', 'recovery']).toContain(r.workout);
  });
});

describe('performanceRecommender', () => {
  it('schedules intervals when HRV is good and ACWR is low', () => {
    const r = performanceRecommender.recommend(goodHrvInput);
    expect(['interval', 'tempo']).toContain(r.workout);
  });
  it('backs off when ACWR is elevated', () => {
    const r = performanceRecommender.recommend(overreachedInput);
    expect(['steady', 'tempo']).toContain(r.workout);
  });
  it('respects HRV — recovery wins over plan', () => {
    const r = performanceRecommender.recommend(poorHrvInput);
    expect(r.workout).toBe('recovery');
  });
});

describe('polarisedRecommender', () => {
  it('inserts a hard day when no recent quality session exists', () => {
    const r = polarisedRecommender.recommend(goodHrvInput);
    expect(['interval', 'steady']).toContain(r.workout);
  });
  it('rests on poor HRV regardless of plan', () => {
    const r = polarisedRecommender.recommend(poorHrvInput);
    expect(r.workout).toBe('rest');
  });
});

describe('recoveryFirstRecommender — recovery branch', () => {
  it('recommends recovery when fatigue ratio is between 0.8 and 0.95', () => {
    // RR diffs that produce rMSSD ≈ baseline * 0.9
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 12,
      recentTrimps: [40, 50, 45],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('recovery');
    expect(r.targetZone).toBe(1);
    expect(r.durationMin).toBe(30);
  });
});

describe('computeFatigueRatio edge cases (via recoveryFirstRecommender)', () => {
  it('returns steady when baselineRmssd is undefined (fatigueRatio defaults to 1)', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 990]),
      baselineRmssd: undefined as unknown as number,
      recentTrimps: [],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });

  it('returns steady when baselineRmssd is 0 (fatigueRatio defaults to 1)', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 990]),
      baselineRmssd: 0,
      recentTrimps: [],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });

  it('returns steady when baselineRmssd is negative (fatigueRatio defaults to 1)', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 990]),
      baselineRmssd: -5,
      recentTrimps: [],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });

  it('returns steady when rrIntervals has fewer than 2 values (fatigueRatio defaults to 1)', () => {
    const input: CoachInput = {
      session: buildSession([1000]),
      baselineRmssd: 50,
      recentTrimps: [],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });

  it('returns steady when rrIntervals is empty (fatigueRatio defaults to 1)', () => {
    const input: CoachInput = {
      session: buildSession([]),
      baselineRmssd: 50,
      recentTrimps: [],
    };
    const r = recoveryFirstRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });
});

describe('performanceRecommender — all branches', () => {
  it('returns interval when HRV is strong (fatigueRatio >= 1.0) and ACWR < 1.0', () => {
    // RR diffs of 50 → rMSSD = 50, baseline = 40 → fatigueRatio = 1.25
    // Last 7 trimps low, chronic high → ACWR < 1.0
    const input: CoachInput = {
      session: buildSession([1000, 1050, 1000, 1050, 1000, 1050, 1000, 1050]),
      baselineRmssd: 40,
      recentTrimps: [
        100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 20, 20,
        20, 20, 20, 20, 20,
      ],
    };
    const r = performanceRecommender.recommend(input);
    expect(r.workout).toBe('interval');
    expect(r.targetZone).toBe(4);
    expect(r.intervals).toEqual({ workSec: 240, restSec: 120, repeats: 5 });
  });

  it('returns tempo as default fallthrough', () => {
    // fatigueRatio >= 0.85, acwr between 1.0 and 1.4
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 10,
      recentTrimps: [60, 60, 60, 60, 60, 60, 60],
    };
    const r = performanceRecommender.recommend(input);
    expect(r.workout).toBe('tempo');
    expect(r.targetZone).toBe(3);
    expect(r.durationMin).toBe(45);
  });

  it('returns steady when ACWR is elevated (> 1.4)', () => {
    // fatigueRatio ≥ 0.85 (to avoid recovery) but ACWR > 1.4
    // RR diffs of 10 → rMSSD = 10, baseline = 10 → fatigueRatio = 1.0
    // Last 7 trimps high, first 21 low → ACWR > 1.4
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 10,
      recentTrimps: [
        20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 100, 100, 100, 100, 100,
        100, 100,
      ],
    };
    const r = performanceRecommender.recommend(input);
    expect(r.workout).toBe('steady');
    expect(r.targetZone).toBe(2);
    expect(r.durationMin).toBe(40);
  });

  it('handles missing recentTrimps (defaults to empty array)', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1050, 950, 1050, 950, 1050, 950]),
      baselineRmssd: 30,
    };
    const r = performanceRecommender.recommend(input);
    // No trimps → acwr defaults to 1, fatigueRatio > 1.0 → should be tempo
    expect(['interval', 'tempo']).toContain(r.workout);
  });
});

describe('polarisedRecommender — all branches', () => {
  it('returns interval when no hard days in recent history and >= 3 entries', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 8,
      recentTrimps: [40, 50, 45, 55, 48, 60, 50],
    };
    const r = polarisedRecommender.recommend(input);
    expect(r.workout).toBe('interval');
    expect(r.targetZone).toBe(5);
    expect(r.intervals).toEqual({ workSec: 180, restSec: 180, repeats: 6 });
  });

  it('returns steady when there are hard days in recent history', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 8,
      recentTrimps: [40, 150, 45],
    };
    const r = polarisedRecommender.recommend(input);
    expect(r.workout).toBe('steady');
    expect(r.targetZone).toBe(2);
    expect(r.durationMin).toBe(60);
  });

  it('returns steady when fewer than 3 recent trimps (even with no hard days)', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 8,
      recentTrimps: [40, 50],
    };
    const r = polarisedRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });

  it('returns steady when recentTrimps is undefined', () => {
    const input: CoachInput = {
      session: buildSession([1000, 1010, 1000, 1010, 1000, 1010]),
      baselineRmssd: 8,
    };
    const r = polarisedRecommender.recommend(input);
    expect(r.workout).toBe('steady');
  });
});

describe('evalRecommender harness', () => {
  it('counts passes and failures across a fixture corpus', () => {
    const cases = [
      { name: 'easy day', input: goodHrvInput, acceptable: ['steady', 'tempo', 'interval'] as const },
      { name: 'rest day', input: poorHrvInput, acceptable: ['rest'] as const },
      { name: 'overreach', input: overreachedInput, acceptable: ['recovery', 'steady'] as const },
    ];
    const result = evalRecommender(performanceRecommender, [...cases]);
    expect(result.total).toBe(3);
    expect(result.passed + result.failed).toBe(3);
    expect(result.recommenderId).toBe('performance-v1');
  });

  it('records failures when recommendation is not in acceptable list', () => {
    const cases = [{ name: 'impossible', input: goodHrvInput, acceptable: ['rest'] as const }];
    const result = evalRecommender(recoveryFirstRecommender, [...cases]);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.caseName).toBe('impossible');
    expect(result.failures[0]!.acceptable).toEqual(['rest']);
  });

  it('returns all passed when every recommendation is acceptable', () => {
    const cases = [{ name: 'rest ok', input: poorHrvInput, acceptable: ['rest', 'recovery'] as const }];
    const result = evalRecommender(recoveryFirstRecommender, [...cases]);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it('handles empty case list', () => {
    const result = evalRecommender(recoveryFirstRecommender, []);
    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
  });
});
