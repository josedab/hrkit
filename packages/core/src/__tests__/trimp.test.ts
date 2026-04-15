import { describe, it, expect } from 'vitest';
import { trimp, weeklyTRIMP } from '../trimp.js';
import type { TimestampedHR, TRIMPConfig, Session } from '../types.js';

const defaultConfig: TRIMPConfig = {
  maxHR: 185,
  restHR: 48,
  sex: 'male',
};

describe('trimp', () => {
  it('returns 0 for fewer than 2 samples', () => {
    expect(trimp([], defaultConfig)).toBe(0);
    expect(trimp([{ timestamp: 0, hr: 150 }], defaultConfig)).toBe(0);
  });

  it('returns 0 when maxHR <= restHR', () => {
    const badConfig: TRIMPConfig = { maxHR: 48, restHR: 48, sex: 'male' };
    const samples: TimestampedHR[] = [
      { timestamp: 0, hr: 150 },
      { timestamp: 60000, hr: 150 },
    ];
    expect(trimp(samples, badConfig)).toBe(0);
  });

  it('computes positive TRIMP for exercise session', () => {
    const samples: TimestampedHR[] = [];
    // 10 minutes at 150bpm, sampled every second
    for (let i = 0; i <= 600; i++) {
      samples.push({ timestamp: i * 1000, hr: 150 });
    }

    const result = trimp(samples, defaultConfig);
    expect(result).toBeGreaterThan(0);
  });

  it('higher intensity produces higher TRIMP', () => {
    const makeSamples = (hr: number): TimestampedHR[] => {
      const s: TimestampedHR[] = [];
      for (let i = 0; i <= 60; i++) {
        s.push({ timestamp: i * 1000, hr });
      }
      return s;
    };

    const lowTRIMP = trimp(makeSamples(100), defaultConfig);
    const highTRIMP = trimp(makeSamples(170), defaultConfig);

    expect(highTRIMP).toBeGreaterThan(lowTRIMP);
  });

  it('applies different sex factors', () => {
    const samples: TimestampedHR[] = [];
    for (let i = 0; i <= 60; i++) {
      samples.push({ timestamp: i * 1000, hr: 150 });
    }

    const maleTRIMP = trimp(samples, { ...defaultConfig, sex: 'male' });
    const femaleTRIMP = trimp(samples, { ...defaultConfig, sex: 'female' });
    const neutralTRIMP = trimp(samples, { ...defaultConfig, sex: 'neutral' });

    // Male has highest sex factor (1.92) → highest TRIMP
    expect(maleTRIMP).toBeGreaterThan(neutralTRIMP);
    expect(neutralTRIMP).toBeGreaterThan(femaleTRIMP);
  });

  it('clamps HRR to [0, 1]', () => {
    const samples: TimestampedHR[] = [
      { timestamp: 0, hr: 30 },       // below rest HR
      { timestamp: 1000, hr: 200 },   // above max HR
    ];

    // Should not throw, and should handle gracefully
    const result = trimp(samples, defaultConfig);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('skips gaps > 30s', () => {
    const samples: TimestampedHR[] = [
      { timestamp: 0, hr: 150 },
      { timestamp: 1000, hr: 150 },      // 1s interval, counted
      { timestamp: 61000, hr: 150 },      // 60s gap, skipped
      { timestamp: 62000, hr: 150 },      // 1s interval, counted
    ];

    const withGap = trimp(samples, defaultConfig);

    const continuous: TimestampedHR[] = [
      { timestamp: 0, hr: 150 },
      { timestamp: 1000, hr: 150 },
      { timestamp: 2000, hr: 150 },
    ];

    const withoutGap = trimp(continuous, defaultConfig);
    expect(withGap).toBeCloseTo(withoutGap, 5);
  });
});

describe('weeklyTRIMP', () => {
  it('aggregates sessions within the week', () => {
    const weekStart = new Date('2024-01-01');
    const samples: TimestampedHR[] = [];
    for (let i = 0; i <= 60; i++) {
      samples.push({ timestamp: weekStart.getTime() + i * 1000, hr: 150 });
    }

    const sessions: Session[] = [
      {
        startTime: weekStart.getTime(),
        endTime: weekStart.getTime() + 60000,
        samples,
        rrIntervals: [],
        rounds: [],
        config: { maxHR: 185, restHR: 48 },
      },
    ];

    const result = weeklyTRIMP(sessions, weekStart);
    expect(result).toBeGreaterThan(0);
  });

  it('excludes sessions outside the week', () => {
    const weekStart = new Date('2024-01-08');
    const sessions: Session[] = [
      {
        startTime: new Date('2024-01-01').getTime(), // previous week
        endTime: new Date('2024-01-01').getTime() + 60000,
        samples: [
          { timestamp: new Date('2024-01-01').getTime(), hr: 150 },
          { timestamp: new Date('2024-01-01').getTime() + 1000, hr: 150 },
        ],
        rrIntervals: [],
        rounds: [],
        config: { maxHR: 185, restHR: 48 },
      },
    ];

    expect(weeklyTRIMP(sessions, weekStart)).toBe(0);
  });
});
