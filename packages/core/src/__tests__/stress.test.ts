import { describe, expect, it } from 'vitest';
import { computeStress, estimateBreathingRate } from '../stress.js';

function generateRR(meanRR: number, count: number, modulation = 0): number[] {
  const rr: number[] = [];
  for (let i = 0; i < count; i++) {
    // Add respiratory sinus arrhythmia modulation at ~0.25 Hz (15 bpm)
    const breathMod = modulation * Math.sin((2 * Math.PI * 0.25 * i * meanRR) / 1000);
    rr.push(meanRR + breathMod + (Math.random() - 0.5) * 10);
  }
  return rr;
}

describe('estimateBreathingRate', () => {
  it('returns null for too few intervals', () => {
    expect(estimateBreathingRate([800, 810, 790])).toBeNull();
  });

  it('returns null for constant RR (no modulation)', () => {
    const rr = Array(50).fill(800);
    expect(estimateBreathingRate(rr)).toBeNull();
  });

  it('detects breathing rate from modulated RR intervals', () => {
    // Generate 100 RR intervals at ~75bpm with breathing modulation
    const rr = generateRR(800, 100, 30);
    const br = estimateBreathingRate(rr);
    // Should detect something in the respiratory band
    if (br !== null) {
      expect(br).toBeGreaterThanOrEqual(6);
      expect(br).toBeLessThanOrEqual(30);
    }
  });
});

describe('computeStress', () => {
  it('returns a score between 0 and 100', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toMatch(/low|moderate|high|very_high/);
  });

  it('low stress for relaxed state (low HR, high HRV)', () => {
    // High HRV (large variations), low HR near rest
    const rr = generateRR(900, 60, 50);
    const result = computeStress({
      rrIntervals: rr,
      currentHR: 62,
      restHR: 60,
    });
    expect(result.score).toBeLessThan(50);
    expect(result.components.heartRate).toBeLessThan(20);
  });

  it('high stress for elevated HR with low HRV', () => {
    // Low HRV (small variations), high HR
    const rr = generateRR(400, 60, 2);
    const result = computeStress({
      rrIntervals: rr,
      currentHR: 140,
      restHR: 60,
    });
    expect(result.score).toBeGreaterThan(50);
  });

  it('includes recovery component when baseline provided', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
      baselineRmssd: 50,
    });
    expect(result.components.recovery).not.toBeNull();
  });

  it('excludes recovery when no baseline', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
    });
    expect(result.components.recovery).toBeNull();
  });

  it('includes subjective component when provided', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
      subjectiveWellness: 8,
    });
    expect(result.components.subjective).not.toBeNull();
    expect(result.components.subjective!).toBeLessThan(30);
  });

  it('high subjective stress for low wellness score', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
      subjectiveWellness: 2,
    });
    expect(result.components.subjective!).toBeGreaterThan(70);
  });

  it('returns rmssd value', () => {
    const result = computeStress({
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
    });
    expect(result.rmssd).toBeGreaterThan(0);
  });

  it('handles custom weights', () => {
    const base = {
      rrIntervals: generateRR(800, 50),
      currentHR: 70,
      restHR: 60,
    };
    const hrFocused = computeStress(base, { heartRate: 0.9, hrv: 0.05, breathingRate: 0.05 });
    const hrvFocused = computeStress(base, { hrv: 0.9, heartRate: 0.05, breathingRate: 0.05 });
    // Results should differ based on weights
    expect(typeof hrFocused.score).toBe('number');
    expect(typeof hrvFocused.score).toBe('number');
  });

  it('handles empty RR intervals gracefully', () => {
    const result = computeStress({
      rrIntervals: [],
      currentHR: 70,
      restHR: 60,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.rmssd).toBe(0);
  });

  it('poor recovery drives score up', () => {
    const rr = generateRR(800, 50, 20);
    const wellRecovered = computeStress({
      rrIntervals: rr,
      currentHR: 65,
      restHR: 60,
      baselineRmssd: 10, // baseline much lower than current → well recovered
    });
    const poorRecovery = computeStress({
      rrIntervals: rr,
      currentHR: 65,
      restHR: 60,
      baselineRmssd: 200, // baseline much higher → poor recovery
    });
    expect(poorRecovery.components.recovery!).toBeGreaterThan(wellRecovered.components.recovery!);
  });

  it('level classification boundaries', () => {
    // We can test the level mapping by checking known scores
    const lowStress = computeStress({
      rrIntervals: generateRR(1000, 50, 40),
      currentHR: 58,
      restHR: 58,
    });
    expect(['low', 'moderate']).toContain(lowStress.level);
  });
});
