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
});
