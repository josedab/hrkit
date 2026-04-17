import { describe, expect, it } from 'vitest';
import { poincareDescriptors, screenForAFib, shannonEntropyRR, turningPointRatio } from '../afib-screening.js';

function generateSinusRhythm(count: number, meanRR = 800): number[] {
  // Normal sinus rhythm: very regular with small HRV (±15ms typical)
  return Array.from({ length: count }, () => meanRR + (Math.random() - 0.5) * 20);
}

function generateIrregularRhythm(count: number): number[] {
  // Simulate AF: highly variable, no pattern
  return Array.from({ length: count }, () => 500 + Math.random() * 600);
}

describe('shannonEntropyRR', () => {
  it('returns 0 for too few intervals', () => {
    expect(shannonEntropyRR([800, 810])).toBe(0);
  });

  it('returns low entropy for regular rhythm', () => {
    const rr = generateSinusRhythm(100);
    const e = shannonEntropyRR(rr);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(3.5);
  });

  it('returns high entropy for irregular rhythm', () => {
    const rr = generateIrregularRhythm(100);
    const e = shannonEntropyRR(rr);
    expect(e).toBeGreaterThan(2.5);
  });

  it('entropy of irregular > entropy of regular', () => {
    const regular = shannonEntropyRR(generateSinusRhythm(200));
    const irregular = shannonEntropyRR(generateIrregularRhythm(200));
    expect(irregular).toBeGreaterThan(regular);
  });
});

describe('poincareDescriptors', () => {
  it('returns zeros for insufficient data', () => {
    const { sd1, sd2 } = poincareDescriptors([800, 810]);
    expect(sd1).toBe(0);
    expect(sd2).toBe(0);
  });

  it('computes SD1 and SD2 for regular rhythm', () => {
    const rr = generateSinusRhythm(100);
    const { sd1, sd2 } = poincareDescriptors(rr);
    expect(sd1).toBeGreaterThan(0);
    expect(sd2).toBeGreaterThan(0);
    // For regular sinus, SD1 < SD2 (short-term < long-term)
    expect(sd1).toBeLessThanOrEqual(sd2 * 2);
  });

  it('SD1 is higher for irregular rhythm', () => {
    const regular = poincareDescriptors(generateSinusRhythm(100));
    const irregular = poincareDescriptors(generateIrregularRhythm(100));
    expect(irregular.sd1).toBeGreaterThan(regular.sd1);
  });
});

describe('turningPointRatio', () => {
  it('returns 0 for insufficient data', () => {
    expect(turningPointRatio([800, 810])).toBe(0);
  });

  it('returns ~0.667 for random-like data', () => {
    // Normal sinus rhythm has some randomness
    const rr = generateSinusRhythm(200);
    const tpr = turningPointRatio(rr);
    expect(tpr).toBeGreaterThan(0.5);
    expect(tpr).toBeLessThan(0.85);
  });

  it('returns value for monotonic data', () => {
    const rr = Array.from({ length: 20 }, (_, i) => 700 + i * 5);
    const tpr = turningPointRatio(rr);
    expect(tpr).toBe(0); // no turning points in monotonic sequence
  });
});

describe('screenForAFib', () => {
  it('returns inconclusive for insufficient data', () => {
    const result = screenForAFib([800, 810, 790]);
    expect(result.classification).toBe('inconclusive');
    expect(result.confidence).toBe(0);
    expect(result.sampleCount).toBe(3);
    expect(result.disclaimer).toContain('NOT a medical device');
  });

  it('classifies regular sinus rhythm as normal or inconclusive', () => {
    const rr = generateSinusRhythm(200);
    const result = screenForAFib(rr);
    expect(['normal', 'inconclusive']).toContain(result.classification);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.sampleCount).toBe(200);
  });

  it('classifies highly irregular rhythm as irregular', () => {
    const rr = generateIrregularRhythm(200);
    const result = screenForAFib(rr);
    expect(result.classification).toBe('irregular');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('always includes disclaimer', () => {
    const result = screenForAFib(generateSinusRhythm(100));
    expect(result.disclaimer).toContain('screening tool');
    expect(result.disclaimer).toContain('healthcare professional');
  });

  it('returns all metrics', () => {
    const result = screenForAFib(generateSinusRhythm(100));
    expect(result.shannonEntropy).toBeGreaterThanOrEqual(0);
    expect(result.sd1).toBeGreaterThanOrEqual(0);
    expect(result.sd2).toBeGreaterThanOrEqual(0);
    expect(result.sd1sd2Ratio).toBeGreaterThanOrEqual(0);
    expect(result.rrCoefficientOfVariation).toBeGreaterThanOrEqual(0);
    expect(result.turningPointRatio).toBeGreaterThanOrEqual(0);
  });

  it('higher confidence with more data', () => {
    const shortResult = screenForAFib(generateSinusRhythm(80));
    const longResult = screenForAFib(generateSinusRhythm(300));
    // Both should be normal, but longer should have higher confidence
    if (shortResult.classification === longResult.classification) {
      expect(longResult.confidence).toBeGreaterThanOrEqual(shortResult.confidence);
    }
  });

  it('respects custom thresholds', () => {
    const rr = generateSinusRhythm(100);
    const strict = screenForAFib(rr, {
      entropyThreshold: 0.5,
      sd1sd2Threshold: 0.1,
      cvThreshold: 1,
    });
    // Very strict thresholds → more likely to classify as irregular
    expect(['irregular', 'inconclusive']).toContain(strict.classification);
  });

  it('respects custom minSamples', () => {
    const rr = generateSinusRhythm(50);
    const withDefault = screenForAFib(rr); // default 60 → inconclusive
    const withLower = screenForAFib(rr, { minSamples: 30 }); // 30 → analyzable
    expect(withDefault.classification).toBe('inconclusive');
    // With lower threshold, actual analysis happens (may be normal or inconclusive based on data)
    expect(withLower.sampleCount).toBe(50);
    expect(withLower.shannonEntropy).toBeGreaterThan(0); // actually analyzed
  });
});
