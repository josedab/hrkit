import { describe, expect, it } from 'vitest';
import { computeReadiness, DEFAULT_WEIGHTS, updateBaseline } from '../index.js';

describe('DEFAULT_WEIGHTS', () => {
  it('weights sum to approximately 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('all weights are non-negative', () => {
    for (const [key, val] of Object.entries(DEFAULT_WEIGHTS)) {
      expect(val, `weight "${key}" should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('all weights are at most 1.0', () => {
    for (const [key, val] of Object.entries(DEFAULT_WEIGHTS)) {
      expect(val, `weight "${key}" should be <= 1`).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeReadiness', () => {
  it('recommends go_hard when everything is dialed', () => {
    const r = computeReadiness({
      todayRmssd: 60,
      baselineRmssd: 55,
      sleepHours: 8,
      restingHr: 50,
      baselineRestingHr: 50,
      atl: 100,
      ctl: 100,
      subjectiveWellness: 9,
    });
    expect(r.recommendation).toBe('go_hard');
    expect(r.score).toBeGreaterThanOrEqual(75);
  });

  it('recommends rest when HRV is suppressed and sleep is low', () => {
    const r = computeReadiness({
      todayRmssd: 28,
      baselineRmssd: 55,
      sleepHours: 4,
      restingHr: 60,
      baselineRestingHr: 50,
      atl: 180,
      ctl: 100,
      subjectiveWellness: 3,
    });
    expect(r.recommendation).toBe('rest');
    expect(r.score).toBeLessThan(55);
    expect(r.rationale.length).toBeGreaterThan(0);
  });

  it('recommends moderate in the middle band', () => {
    const r = computeReadiness({
      todayRmssd: 50,
      baselineRmssd: 55,
      sleepHours: 6.5,
      restingHr: 53,
      baselineRestingHr: 50,
      atl: 110,
      ctl: 100,
    });
    expect(['moderate', 'go_hard']).toContain(r.recommendation);
  });

  it('handles sparse input by treating missing components as neutral 0.5', () => {
    const r = computeReadiness({ todayRmssd: 55, baselineRmssd: 55 });
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('respects custom weights', () => {
    const heavy = computeReadiness(
      { todayRmssd: 30, baselineRmssd: 55 },
      { weights: { hrv: 1, acwr: 0, sleep: 0, hrDrift: 0, subjective: 0 } },
    );
    expect(heavy.recommendation).toBe('rest');
  });
});

describe('updateBaseline', () => {
  it('rolls the window and recomputes mean+sd', () => {
    let state = { window: [] as number[] };
    for (const v of [50, 52, 54, 56, 58, 60, 55]) {
      ({ state } = updateBaseline(state, v));
    }
    const { mean, sd } = updateBaseline(state, 57);
    expect(mean).toBeGreaterThan(54);
    expect(mean).toBeLessThan(58);
    expect(sd).toBeGreaterThan(0);
  });

  it('handles single data point', () => {
    const { mean, sd, state } = updateBaseline({ window: [] }, 55);
    expect(mean).toBe(55);
    expect(sd).toBe(0);
    expect(state.window).toHaveLength(1);
  });
});

describe('computeReadiness edge cases', () => {
  it('handles zero RMSSD gracefully', () => {
    const r = computeReadiness({ todayRmssd: 0, baselineRmssd: 0 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(typeof r.recommendation).toBe('string');
  });

  it('handles zero baselineRmssd with positive todayRmssd', () => {
    const r = computeReadiness({ todayRmssd: 55, baselineRmssd: 0 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('handles extreme sleep values', () => {
    const r = computeReadiness({
      todayRmssd: 55,
      baselineRmssd: 55,
      sleepHours: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    const r2 = computeReadiness({
      todayRmssd: 55,
      baselineRmssd: 55,
      sleepHours: 14,
    });
    expect(r2.score).toBeLessThanOrEqual(100);
  });

  it('score stays in 0-100 range with all extreme inputs', () => {
    const r = computeReadiness({
      todayRmssd: 200,
      baselineRmssd: 10,
      sleepHours: 16,
      restingHr: 30,
      baselineRestingHr: 80,
      atl: 0,
      ctl: 500,
      subjectiveWellness: 10,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('handles boundary score: exactly at moderate/go_hard transition', () => {
    // Scores around 75 should produce consistent recommendations
    const r = computeReadiness({
      todayRmssd: 55,
      baselineRmssd: 55,
      sleepHours: 7,
      restingHr: 50,
      baselineRestingHr: 50,
      atl: 100,
      ctl: 100,
      subjectiveWellness: 7,
    });
    expect(['moderate', 'go_hard']).toContain(r.recommendation);
  });

  it('provides rationale when components are weak', () => {
    const r = computeReadiness({
      todayRmssd: 25,
      baselineRmssd: 55,
      sleepHours: 4,
      restingHr: 65,
      baselineRestingHr: 50,
      atl: 200,
      ctl: 100,
      subjectiveWellness: 2,
    });
    expect(r.rationale.length).toBeGreaterThan(0);
  });

  it('handles subjectiveWellness at bounds', () => {
    const low = computeReadiness({
      todayRmssd: 55,
      baselineRmssd: 55,
      subjectiveWellness: 1,
    });
    const high = computeReadiness({
      todayRmssd: 55,
      baselineRmssd: 55,
      subjectiveWellness: 10,
    });
    expect(high.score).toBeGreaterThanOrEqual(low.score);
  });
});
