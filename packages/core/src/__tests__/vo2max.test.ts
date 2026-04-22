import { describe, expect, it } from 'vitest';
import { estimateVO2maxCooper, estimateVO2maxFromSession, estimateVO2maxUth, fitnessScore } from '../vo2max.js';

describe('estimateVO2maxUth', () => {
  it('estimates VO2max from resting and max HR', () => {
    const r = estimateVO2maxUth(190, 60);
    // 15.3 * (190/60) = 48.45
    expect(r.vo2max).toBeCloseTo(48.45, 1);
    expect(r.method).toBe('uth');
    expect(r.ciLower).toBeLessThan(r.vo2max);
    expect(r.ciUpper).toBeGreaterThan(r.vo2max);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('returns zero for invalid inputs', () => {
    expect(estimateVO2maxUth(100, 0).vo2max).toBe(0);
    expect(estimateVO2maxUth(60, 80).vo2max).toBe(0);
    expect(estimateVO2maxUth(60, 60).vo2max).toBe(0);
  });

  it('gives higher confidence for lower resting HR', () => {
    const athletic = estimateVO2maxUth(180, 45);
    const average = estimateVO2maxUth(180, 70);
    expect(athletic.confidence).toBeGreaterThan(average.confidence);
  });

  it('produces reasonable values for typical athlete', () => {
    const r = estimateVO2maxUth(185, 55);
    expect(r.vo2max).toBeGreaterThan(40);
    expect(r.vo2max).toBeLessThan(60);
  });
});

describe('estimateVO2maxFromSession', () => {
  it('estimates from steady-state session', () => {
    // Simulate 20min at ~65% HRR (rest 60, max 190, steady HR ~145)
    const hrSamples = Array.from({ length: 60 }, (_, i) => 140 + (i % 10));
    const r = estimateVO2maxFromSession({
      hrSamples,
      durationMin: 20,
      restHR: 60,
      maxHR: 190,
    });
    expect(r).not.toBeNull();
    expect(r!.vo2max).toBeGreaterThanOrEqual(10);
    expect(r!.vo2max).toBeLessThan(90);
    expect(r!.method).toBe('session');
  });

  it('returns null for too-short sessions', () => {
    expect(
      estimateVO2maxFromSession({
        hrSamples: [100, 110, 120],
        durationMin: 3,
        restHR: 60,
        maxHR: 190,
      }),
    ).toBeNull();
  });

  it('returns null for invalid HR parameters', () => {
    expect(
      estimateVO2maxFromSession({
        hrSamples: Array(20).fill(130),
        durationMin: 10,
        restHR: 0,
        maxHR: 190,
      }),
    ).toBeNull();
  });

  it('returns null for too-low intensity', () => {
    // HR barely above rest → HRR too low
    expect(
      estimateVO2maxFromSession({
        hrSamples: Array(20).fill(70),
        durationMin: 10,
        restHR: 60,
        maxHR: 190,
      }),
    ).toBeNull();
  });

  it('returns null for too-high intensity', () => {
    // Near-max HR → HRR too high
    expect(
      estimateVO2maxFromSession({
        hrSamples: Array(20).fill(185),
        durationMin: 10,
        restHR: 60,
        maxHR: 190,
      }),
    ).toBeNull();
  });

  it('gives higher confidence for longer sessions', () => {
    const samples = Array.from({ length: 60 }, () => 140);
    const short = estimateVO2maxFromSession({
      hrSamples: samples.slice(0, 20),
      durationMin: 8,
      restHR: 60,
      maxHR: 190,
    });
    const long = estimateVO2maxFromSession({
      hrSamples: samples,
      durationMin: 25,
      restHR: 60,
      maxHR: 190,
    });
    expect(short).not.toBeNull();
    expect(long).not.toBeNull();
    expect(long!.confidence).toBeGreaterThan(short!.confidence);
  });
});

describe('estimateVO2maxCooper', () => {
  it('estimates from 12-min run distance', () => {
    // 2400m → (2400 - 504.9) / 44.73 ≈ 42.35
    const r = estimateVO2maxCooper(2400);
    expect(r.vo2max).toBeCloseTo(42.35, 0);
    expect(r.method).toBe('cooper');
    expect(r.confidence).toBe(0.8);
  });

  it('handles zero distance', () => {
    const r = estimateVO2maxCooper(0);
    expect(r.vo2max).toBe(0);
    expect(r.confidence).toBe(0);
  });

  it('handles very short distance', () => {
    const r = estimateVO2maxCooper(500);
    expect(r.vo2max).toBeCloseTo(0, 0);
  });

  it('handles elite distance', () => {
    const r = estimateVO2maxCooper(3700);
    expect(r.vo2max).toBeGreaterThan(70);
  });
});

describe('fitnessScore', () => {
  it('scores a fit young male', () => {
    const s = fitnessScore(50, 25, 'male');
    expect(s.percentile).toBeGreaterThanOrEqual(75);
    expect(s.category).toMatch(/excellent|superior/);
    expect(s.ageGroup).toBe('20-29');
    expect(s.sex).toBe('male');
  });

  it('scores an average middle-aged female', () => {
    const s = fitnessScore(28.5, 45, 'female');
    expect(s.percentile).toBeGreaterThanOrEqual(40);
    expect(s.percentile).toBeLessThanOrEqual(60);
    expect(s.ageGroup).toBe('40-49');
  });

  it('scores very low fitness', () => {
    const s = fitnessScore(15, 30, 'male');
    expect(s.percentile).toBeLessThanOrEqual(10);
    expect(s.category).toBe('very_poor');
  });

  it('scores elite fitness', () => {
    const s = fitnessScore(60, 25, 'male');
    expect(s.percentile).toBeGreaterThanOrEqual(90);
    expect(s.category).toBe('superior');
  });

  it('handles older age groups', () => {
    const s = fitnessScore(25, 75, 'male');
    expect(s.ageGroup).toBe('70+');
    expect(s.percentile).toBeGreaterThan(0);
  });

  it('returns correct category boundaries', () => {
    expect(fitnessScore(18, 25, 'female').category).toBe('very_poor');
    expect(fitnessScore(25, 25, 'female').category).toBe('poor');
    expect(fitnessScore(30, 25, 'female').category).toBe('fair');
    expect(fitnessScore(36, 25, 'female').category).toBe('good');
    expect(fitnessScore(42, 25, 'female').category).toBe('excellent');
    expect(fitnessScore(48, 25, 'female').category).toBe('superior');
  });

  it('handles negative age gracefully (defaults to youngest group)', () => {
    const s = fitnessScore(40, -5, 'male');
    expect(s.ageGroup).toBe('20-29');
  });

  it('handles NaN vo2max without crashing', () => {
    const s = fitnessScore(NaN, 30, 'male');
    expect(s.percentile).toBe(50);
    expect(s.category).toBe('good');
  });

  it('handles NaN age gracefully', () => {
    const s = fitnessScore(40, NaN, 'male');
    expect(s.ageGroup).toBe('20-29');
  });
});
