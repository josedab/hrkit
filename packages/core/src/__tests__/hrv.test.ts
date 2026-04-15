import { describe, it, expect } from 'vitest';
import { rmssd, sdnn, pnn50, meanHR, hrBaseline, readinessVerdict } from '../hrv.js';

describe('rmssd', () => {
  it('returns 0 for fewer than 2 intervals', () => {
    expect(rmssd([])).toBe(0);
    expect(rmssd([800])).toBe(0);
  });

  it('computes RMSSD correctly', () => {
    const rr = [800, 810, 790, 820, 805];
    // Diffs: 10, -20, 30, -15
    // Squared: 100, 400, 900, 225
    // Mean: 1625/4 = 406.25
    // RMSSD: sqrt(406.25) ≈ 20.16
    expect(rmssd(rr)).toBeCloseTo(20.16, 1);
  });

  it('returns 0 for constant intervals', () => {
    const rr = [800, 800, 800, 800];
    expect(rmssd(rr)).toBe(0);
  });
});

describe('sdnn', () => {
  it('returns 0 for fewer than 2 intervals', () => {
    expect(sdnn([])).toBe(0);
    expect(sdnn([800])).toBe(0);
  });

  it('computes SDNN correctly', () => {
    const rr = [800, 810, 790, 820, 805];
    // mean = 805
    // Deviations: -5, 5, -15, 15, 0
    // Squared: 25, 25, 225, 225, 0
    // Variance: 500/5 = 100
    // SDNN: sqrt(100) = 10
    expect(sdnn(rr)).toBeCloseTo(10, 1);
  });
});

describe('pnn50', () => {
  it('returns 0 for fewer than 2 intervals', () => {
    expect(pnn50([])).toBe(0);
    expect(pnn50([800])).toBe(0);
  });

  it('computes pNN50 correctly', () => {
    const rr = [800, 860, 810, 870, 820];
    // Diffs: |60|, |50|, |60|, |50| → 4 > 50ms, but 50 is not > 50
    // Count: |60|>50=yes, |50|>50=no, |60|>50=yes, |50|>50=no → 2/4 = 50%
    expect(pnn50(rr)).toBeCloseTo(50, 1);
  });

  it('returns 0 for constant intervals', () => {
    expect(pnn50([800, 800, 800])).toBe(0);
  });
});

describe('meanHR', () => {
  it('returns 0 for empty array', () => {
    expect(meanHR([])).toBe(0);
  });

  it('computes mean HR from RR intervals', () => {
    // meanRR = 800ms → 60000/800 = 75 bpm
    expect(meanHR([800, 800, 800])).toBe(75);
  });

  it('handles varied intervals', () => {
    const rr = [750, 800, 850]; // mean = 800 → 75 bpm
    expect(meanHR(rr)).toBe(75);
  });
});

describe('hrBaseline', () => {
  it('returns null for empty readings', () => {
    expect(hrBaseline([], 7)).toBeNull();
  });

  it('returns null for zero window', () => {
    expect(hrBaseline([{ date: '2024-01-01', rmssd: 50 }], 0)).toBeNull();
  });

  it('returns median of readings within window', () => {
    const readings = [
      { date: '2024-01-01', rmssd: 40 },
      { date: '2024-01-02', rmssd: 50 },
      { date: '2024-01-03', rmssd: 60 },
      { date: '2024-01-04', rmssd: 45 },
      { date: '2024-01-05', rmssd: 55 },
    ];
    // Sorted by date, last 3: 60, 45, 55 → sorted by value: 45, 55, 60 → median: 55
    expect(hrBaseline(readings, 3)).toBe(55);
  });

  it('handles even number of readings with average', () => {
    const readings = [
      { date: '2024-01-01', rmssd: 40 },
      { date: '2024-01-02', rmssd: 60 },
    ];
    expect(hrBaseline(readings, 7)).toBe(50);
  });
});

describe('readinessVerdict', () => {
  it('returns go_hard when >=95% of baseline', () => {
    expect(readinessVerdict(57, 60)).toBe('go_hard');
    expect(readinessVerdict(60, 60)).toBe('go_hard');
  });

  it('returns moderate when 80-95% of baseline', () => {
    expect(readinessVerdict(50, 60)).toBe('moderate');
    expect(readinessVerdict(48, 60)).toBe('moderate');
  });

  it('returns rest when <80% of baseline', () => {
    expect(readinessVerdict(40, 60)).toBe('rest');
    expect(readinessVerdict(47, 60)).toBe('rest');
  });

  it('handles edge case of zero baseline', () => {
    expect(readinessVerdict(50, 0)).toBe('rest');
  });

  it('handles negative baseline', () => {
    expect(readinessVerdict(50, -10)).toBe('rest');
  });
});
