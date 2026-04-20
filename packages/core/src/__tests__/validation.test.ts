import { describe, expect, it } from 'vitest';
import {
  blandAltman,
  DEFAULT_HR_THRESHOLDS,
  DEFAULT_RMSSD_THRESHOLDS,
  mape,
  validateAgainstReference,
} from '../validation.js';

describe('mape', () => {
  it('returns 0 for identical inputs', () => {
    const r = mape([60, 70, 80], [60, 70, 80]);
    expect(r.mape).toBe(0);
    expect(r.n).toBe(3);
  });

  it('computes mean absolute percentage error', () => {
    // Errors: 10/100, 5/200, 0/300 = 10%, 2.5%, 0% → mean 4.1666…%
    const r = mape([100, 200, 300], [110, 195, 300]);
    expect(r.mape).toBeCloseTo(4.166, 2);
    expect(r.n).toBe(3);
  });

  it('skips reference values of zero', () => {
    const r = mape([0, 100], [10, 110]);
    expect(r.n).toBe(1);
  });

  it('throws on length mismatch', () => {
    expect(() => mape([1, 2], [1])).toThrow();
  });
});

describe('blandAltman', () => {
  it('reports zero bias for identical inputs', () => {
    const ba = blandAltman([60, 70, 80, 90], [60, 70, 80, 90]);
    expect(ba.bias).toBe(0);
    expect(ba.sd).toBe(0);
    expect(ba.loaLower).toBe(0);
    expect(ba.loaUpper).toBe(0);
  });

  it('computes bias and limits of agreement', () => {
    const ba = blandAltman([60, 70, 80, 90], [62, 71, 79, 92]);
    // Differences: 2, 1, -1, 2 → mean 1, sample sd ≈ 1.4142
    expect(ba.bias).toBeCloseTo(1, 5);
    const sd = Math.SQRT2;
    expect(ba.sd).toBeCloseTo(sd, 3);
    expect(ba.loaUpper).toBeCloseTo(1 + 1.96 * sd, 2);
    expect(ba.loaLower).toBeCloseTo(1 - 1.96 * sd, 2);
    expect(ba.points).toHaveLength(4);
  });
});

describe('validateAgainstReference', () => {
  it('passes when all metrics are within thresholds', () => {
    const reference = [60, 65, 70, 75, 80, 85, 90];
    const measured = reference.map((x) => x + 0.5); // small constant bias, well within limits
    const r = validateAgainstReference(reference, measured, DEFAULT_HR_THRESHOLDS);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });

  it('fails when MAPE exceeds threshold', () => {
    const reference = [60, 70, 80, 90];
    const measured = [80, 90, 100, 110]; // ~25% high
    const r = validateAgainstReference(reference, measured, DEFAULT_HR_THRESHOLDS);
    expect(r.passed).toBe(false);
    expect(r.failures.some((f) => f.startsWith('MAPE'))).toBe(true);
  });

  it('flags rMSSD agreement issues with looser RMSSD thresholds', () => {
    const reference = [40, 45, 38, 50, 42, 48];
    const measured = [60, 65, 58, 70, 62, 68]; // +20 ms bias
    const r = validateAgainstReference(reference, measured, DEFAULT_RMSSD_THRESHOLDS);
    expect(r.passed).toBe(false);
    expect(r.failures.some((f) => f.startsWith('|bias|'))).toBe(true);
  });
});
