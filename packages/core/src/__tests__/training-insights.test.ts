import { describe, it, expect } from 'vitest';
import {
  assessACWRRisk,
  analyzeHRVTrend,
  calculateMonotony,
  getTrainingRecommendation,
} from '../training-insights.js';
import type {
  TrainingLoadPoint,
  HRVTrendPoint,
  TrainingVerdict,
} from '../training-insights.js';

function makeTrainingLoad(
  days: number,
  dailyTrimp: number,
  overrides?: Partial<TrainingLoadPoint>,
): TrainingLoadPoint[] {
  const base = new Date('2024-03-01');
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(base);
    date.setDate(base.getDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      atl: dailyTrimp,
      ctl: dailyTrimp * 0.9,
      acwr: 1.0,
      tsb: 0,
      ...overrides,
    };
  });
}

function makeHRVTrend(
  days: number,
  pattern: 'improving' | 'stable' | 'declining',
): HRVTrendPoint[] {
  const base = new Date('2024-03-01');
  const startRmssd = 50;
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(base);
    date.setDate(base.getDate() + i);

    let rmssd: number;
    let rollingAvg: number;
    switch (pattern) {
      case 'improving':
        rmssd = startRmssd + i * 3;
        rollingAvg = startRmssd + i * 3;
        break;
      case 'declining':
        rmssd = startRmssd - i * 3;
        rollingAvg = startRmssd - i * 3;
        break;
      case 'stable':
        rmssd = startRmssd + (i % 2 === 0 ? 1 : -1);
        rollingAvg = startRmssd;
        break;
    }

    return {
      date: date.toISOString().slice(0, 10),
      rmssd,
      rollingAvg,
      cv: 5,
    };
  });
}

describe('assessACWRRisk', () => {
  it('returns moderate for ACWR < 0.8 (undertrained)', () => {
    expect(assessACWRRisk(0.5)).toBe('moderate');
    expect(assessACWRRisk(0.79)).toBe('moderate');
  });

  it('returns low for ACWR 0.8-1.3 (sweet spot)', () => {
    expect(assessACWRRisk(0.8)).toBe('low');
    expect(assessACWRRisk(0.9)).toBe('low');
    expect(assessACWRRisk(1.2)).toBe('low');
    expect(assessACWRRisk(1.3)).toBe('low');
  });

  it('returns high for ACWR 1.3-1.5 (caution)', () => {
    expect(assessACWRRisk(1.4)).toBe('high');
    expect(assessACWRRisk(1.31)).toBe('high');
    expect(assessACWRRisk(1.5)).toBe('high');
  });

  it('returns critical for ACWR > 1.5 (danger)', () => {
    expect(assessACWRRisk(1.51)).toBe('critical');
    expect(assessACWRRisk(1.8)).toBe('critical');
    expect(assessACWRRisk(2.5)).toBe('critical');
  });
});

describe('analyzeHRVTrend', () => {
  it('detects improving trend', () => {
    const trend = makeHRVTrend(7, 'improving');
    const result = analyzeHRVTrend(trend);
    expect(result.direction).toBe('improving');
    expect(result.magnitude).toBeGreaterThan(5);
    expect(result.concern).toBe(false);
  });

  it('detects stable trend', () => {
    const trend = makeHRVTrend(7, 'stable');
    const result = analyzeHRVTrend(trend);
    expect(result.direction).toBe('stable');
    expect(result.concern).toBe(false);
  });

  it('detects declining trend', () => {
    const trend = makeHRVTrend(7, 'declining');
    const result = analyzeHRVTrend(trend);
    expect(result.direction).toBe('declining');
    expect(result.magnitude).toBeGreaterThan(5);
  });

  it('flags concern when declining for 3+ consecutive days', () => {
    const trend = makeHRVTrend(7, 'declining');
    const result = analyzeHRVTrend(trend);
    expect(result.concern).toBe(true);
  });

  it('returns stable for empty data', () => {
    const result = analyzeHRVTrend([]);
    expect(result.direction).toBe('stable');
    expect(result.magnitude).toBe(0);
    expect(result.concern).toBe(false);
  });

  it('returns stable for single data point', () => {
    const result = analyzeHRVTrend([
      { date: '2024-03-01', rmssd: 50, rollingAvg: 50, cv: 5 },
    ]);
    expect(result.direction).toBe('stable');
    expect(result.magnitude).toBe(0);
  });
});

describe('calculateMonotony', () => {
  it('returns high monotony for identical daily loads', () => {
    const load = makeTrainingLoad(7, 100);
    const result = calculateMonotony(load);
    expect(result).toBe(Infinity);
  });

  it('returns low monotony for varied loads', () => {
    const load = makeTrainingLoad(7, 100).map((p, i) => ({
      ...p,
      atl: 20 + i * 40,
    }));
    const result = calculateMonotony(load);
    expect(result).toBeLessThan(2.0);
  });

  it('returns 0 for fewer than 2 data points', () => {
    expect(calculateMonotony([])).toBe(0);
    expect(calculateMonotony(makeTrainingLoad(1, 100))).toBe(0);
  });
});

describe('getTrainingRecommendation', () => {
  it('returns go_hard when ACWR is in sweet spot and HRV improving', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.1, tsb: 5 }),
      hrvTrend: makeHRVTrend(7, 'improving'),
      maxHR: 190,
    });
    expect(result.verdict).toBe('go_hard');
    expect(result.riskLevel).toBe('low');
  });

  it('returns rest when ACWR is critical', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 120, { acwr: 1.6, tsb: -10 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      maxHR: 190,
    });
    expect(result.verdict).toBe('rest');
    expect(result.riskLevel).toBe('critical');
  });

  it('returns easy when HRV is declining with elevated ACWR', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.1, tsb: 0 }),
      hrvTrend: makeHRVTrend(7, 'declining'),
      maxHR: 190,
    });
    expect(result.verdict).toBe('easy');
  });

  it('returns deload when TSB is very negative', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 100, { acwr: 1.0, tsb: -25 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      maxHR: 190,
    });
    expect(result.verdict).toBe('deload');
  });

  it('handles missing optional data gracefully', () => {
    const result = getTrainingRecommendation({
      trainingLoad: [],
      hrvTrend: [],
      maxHR: 190,
    });
    expect(result.verdict).toBeDefined();
    expect(result.riskLevel).toBeDefined();
    expect(result.prescription).toBeDefined();
  });

  it('scales confidence with data availability', () => {
    const minimal = getTrainingRecommendation({
      trainingLoad: [],
      hrvTrend: [],
      maxHR: 190,
    });
    expect(minimal.confidence).toBe(0.5);

    const withAll = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.0, tsb: 0 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      todayRmssd: 55,
      baselineRmssd: 50,
      maxHR: 190,
    });
    expect(withAll.confidence).toBeCloseTo(0.9, 10);

    const full = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.0, tsb: 0 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      todayRmssd: 55,
      baselineRmssd: 50,
      maxHR: 190,
      restHR: 60,
    });
    // maxes at 1.0
    expect(full.confidence).toBeLessThanOrEqual(1.0);
  });

  it('populates reasons array', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.1, tsb: 5 }),
      hrvTrend: makeHRVTrend(7, 'improving'),
      todayRmssd: 55,
      baselineRmssd: 50,
      maxHR: 190,
    });
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(reason.factor).toBeDefined();
      expect(reason.message).toBeDefined();
      expect(typeof reason.concern).toBe('boolean');
    }
  });

  it('returns a non-empty summary string', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.0, tsb: 0 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      maxHR: 190,
    });
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('recommends rest when HRV baseline ratio is poor', () => {
    const result = getTrainingRecommendation({
      trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.0, tsb: 0 }),
      hrvTrend: makeHRVTrend(7, 'stable'),
      todayRmssd: 30,
      baselineRmssd: 50,
      maxHR: 190,
    });
    expect(result.verdict).toBe('rest');
    expect(result.reasons.some((r) => r.factor === 'hrv_baseline' && r.concern)).toBe(true);
  });
});

describe('prescription zones match verdict', () => {
  const cases: [TrainingVerdict, 1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 5][] = [
    ['go_hard', 4, 5],
    ['rest', 1, 2],
    ['easy', 2, 3],
    ['deload', 2, 3],
  ];

  for (const [expectedVerdict, primaryZone, maxZone] of cases) {
    it(`${expectedVerdict} → primary zone ${primaryZone}, max zone ${maxZone}`, () => {
      let input;
      switch (expectedVerdict) {
        case 'go_hard':
          input = {
            trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.1, tsb: 5 }),
            hrvTrend: makeHRVTrend(7, 'improving'),
            maxHR: 190,
          };
          break;
        case 'rest':
          input = {
            trainingLoad: makeTrainingLoad(28, 120, { acwr: 1.6, tsb: -10 }),
            hrvTrend: makeHRVTrend(7, 'stable'),
            maxHR: 190,
          };
          break;
        case 'easy':
          input = {
            trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.1, tsb: 0 }),
            hrvTrend: makeHRVTrend(7, 'declining'),
            maxHR: 190,
          };
          break;
        case 'deload':
          input = {
            trainingLoad: makeTrainingLoad(28, 100, { acwr: 1.0, tsb: -25 }),
            hrvTrend: makeHRVTrend(7, 'stable'),
            maxHR: 190,
          };
          break;
        default:
          input = {
            trainingLoad: makeTrainingLoad(28, 80, { acwr: 1.0, tsb: 0 }),
            hrvTrend: makeHRVTrend(7, 'stable'),
            maxHR: 190,
          };
      }

      const result = getTrainingRecommendation(input);
      expect(result.verdict).toBe(expectedVerdict);
      expect(result.prescription.primaryZone).toBe(primaryZone);
      expect(result.prescription.maxZone).toBe(maxZone);
    });
  }
});

describe('boundary conditions', () => {
  it('assessACWRRisk at exact boundaries', () => {
    expect(assessACWRRisk(0.8)).toBe('low');      // exactly 0.8 is sweet spot
    expect(assessACWRRisk(1.3)).toBe('low');       // exactly 1.3 is still sweet spot
    expect(assessACWRRisk(1.5)).toBe('high');      // exactly 1.5 is high, not critical
    expect(assessACWRRisk(0)).toBe('moderate');     // zero ACWR is undertrained
  });

  it('assessACWRRisk with negative ACWR', () => {
    expect(assessACWRRisk(-1)).toBe('moderate');
  });

  it('analyzeHRVTrend with flat data (0% change)', () => {
    const trend = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${10 + i}`, rmssd: 50, rollingAvg: 50, cv: 0.1,
    }));
    const result = analyzeHRVTrend(trend);
    expect(result.direction).toBe('stable');
    expect(result.magnitude).toBe(0);
  });

  it('conflicting signals: good ACWR but declining HRV', () => {
    // ACWR slightly above 1.0 in sweet spot but HRV declining → should recommend easy
    const trainingLoad = Array.from({ length: 28 }, (_, i) => ({
      date: `2024-01-${i + 1}`, atl: 80 + (i % 5) * 10, ctl: 100, acwr: 1.1, tsb: 0,
    }));
    const hrvTrend = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${21 + i}`, rmssd: 50 - i * 5, rollingAvg: 50 - i * 5, cv: 0.1,
    }));

    const rec = getTrainingRecommendation({
      trainingLoad, hrvTrend, maxHR: 185,
    });
    expect(rec.verdict).toBe('easy');
  });

  it('handles baselineRmssd of 0 without crashing', () => {
    const rec = getTrainingRecommendation({
      trainingLoad: [], hrvTrend: [],
      todayRmssd: 50, baselineRmssd: 0,
      maxHR: 185,
    });
    // Should not crash, no HRV baseline reason added
    expect(rec.reasons.find(r => r.factor === 'hrv_baseline')).toBeUndefined();
  });

  it('calculateMonotony with all identical loads returns Infinity', () => {
    const load = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${i + 1}`, atl: 100, ctl: 100, acwr: 1.0, tsb: 0,
    }));
    expect(calculateMonotony(load)).toBe(Infinity);
  });
});
