import { describe, it, expect } from 'vitest';
import { hrToZone, zoneDistribution } from '../zones.js';
import type { HRZoneConfig, TimestampedHR } from '../types.js';

const defaultConfig: HRZoneConfig = {
  maxHR: 185,
  zones: [0.6, 0.7, 0.8, 0.9],
};

describe('hrToZone', () => {
  it('returns zone 1 for low HR', () => {
    expect(hrToZone(100, defaultConfig)).toBe(1); // 100/185 = 54% < 60%
  });

  it('returns zone 2 for moderate HR', () => {
    expect(hrToZone(120, defaultConfig)).toBe(2); // 120/185 = 64.9% → zone 2
  });

  it('returns zone 3 for elevated HR', () => {
    expect(hrToZone(140, defaultConfig)).toBe(3); // 140/185 = 75.7% → zone 3
  });

  it('returns zone 4 for high HR', () => {
    expect(hrToZone(162, defaultConfig)).toBe(4); // 162/185 = 87.6% → zone 4
  });

  it('returns zone 5 for max HR', () => {
    expect(hrToZone(175, defaultConfig)).toBe(5); // 175/185 = 94.6% → zone 5
  });

  it('handles exact threshold boundaries', () => {
    // Exactly at 60% threshold (111) → zone 2
    expect(hrToZone(111, defaultConfig)).toBe(2);
    // Exactly at 90% threshold (166.5)
    expect(hrToZone(167, defaultConfig)).toBe(5);
  });

  it('handles very low HR', () => {
    expect(hrToZone(50, defaultConfig)).toBe(1);
  });

  it('handles HR above max', () => {
    expect(hrToZone(200, defaultConfig)).toBe(5);
  });
});

describe('zoneDistribution', () => {
  it('computes time in each zone', () => {
    const samples: TimestampedHR[] = [
      { timestamp: 0, hr: 100 },    // zone 1, 1s
      { timestamp: 1000, hr: 120 }, // zone 2, 1s
      { timestamp: 2000, hr: 140 }, // zone 3, 1s
      { timestamp: 3000, hr: 165 }, // zone 4, 1s
      { timestamp: 4000, hr: 175 }, // zone 5 (last sample, no duration)
    ];

    const result = zoneDistribution(samples, defaultConfig);

    expect(result.zones[1]).toBeCloseTo(1, 1);
    expect(result.zones[2]).toBeCloseTo(1, 1);
    expect(result.zones[3]).toBeCloseTo(1, 1);
    expect(result.zones[4]).toBeCloseTo(1, 1);
    expect(result.zones[5]).toBe(0); // last sample has no next
    expect(result.total).toBeCloseTo(4, 1);
  });

  it('returns zero distribution for single sample', () => {
    const result = zoneDistribution([{ timestamp: 0, hr: 100 }], defaultConfig);
    expect(result.total).toBe(0);
  });

  it('returns zero distribution for empty samples', () => {
    const result = zoneDistribution([], defaultConfig);
    expect(result.total).toBe(0);
  });

  it('skips gaps longer than 30 seconds', () => {
    const samples: TimestampedHR[] = [
      { timestamp: 0, hr: 100 },       // zone 1, 1s
      { timestamp: 1000, hr: 120 },    // zone 2, gap of 60s → skipped
      { timestamp: 61000, hr: 140 },   // zone 3, 1s
      { timestamp: 62000, hr: 150 },   // last
    ];

    const result = zoneDistribution(samples, defaultConfig);
    expect(result.total).toBeCloseTo(2, 1); // only 2 valid intervals
  });
});
