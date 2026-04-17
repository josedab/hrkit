import { describe, expect, it } from 'vitest';
import { computeReadiness, updateBaseline } from '../index.js';

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
});
