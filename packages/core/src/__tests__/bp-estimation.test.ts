import { describe, expect, it } from 'vitest';
import { type BPCalibration, estimateBloodPressure, extractPTT } from '../bp-estimation.js';

describe('extractPTT', () => {
  it('extracts PTTs from aligned peaks', () => {
    const rPeaks = [100, 900, 1700];
    const ppgPeaks = [250, 1050, 1850];
    const ptts = extractPTT({ rPeakTimestamps: rPeaks, ppgPeakTimestamps: ppgPeaks });
    expect(ptts).toHaveLength(3);
    expect(ptts[0]).toBeCloseTo(150, 0);
    expect(ptts[1]).toBeCloseTo(150, 0);
  });

  it('skips PTTs outside physiological range', () => {
    const rPeaks = [100, 200];
    const ppgPeaks = [110, 800]; // 10ms too short, 600ms too long
    const ptts = extractPTT({ rPeakTimestamps: rPeaks, ppgPeakTimestamps: ppgPeaks });
    expect(ptts).toHaveLength(0);
  });

  it('returns empty for empty inputs', () => {
    expect(extractPTT({ rPeakTimestamps: [], ppgPeakTimestamps: [] })).toEqual([]);
    expect(extractPTT({ rPeakTimestamps: [100], ppgPeakTimestamps: [] })).toEqual([]);
  });

  it('handles unaligned peaks', () => {
    const rPeaks = [100, 900, 1700, 2500];
    const ppgPeaks = [220, 1020, 1820]; // only 3 PPG peaks for 4 R-peaks
    const ptts = extractPTT({ rPeakTimestamps: rPeaks, ppgPeakTimestamps: ppgPeaks });
    expect(ptts).toHaveLength(3);
  });

  it('skips PPG peaks that precede R-peaks', () => {
    const rPeaks = [500, 1300];
    const ppgPeaks = [100, 650, 1450]; // first PPG before first R
    const ptts = extractPTT({ rPeakTimestamps: rPeaks, ppgPeakTimestamps: ppgPeaks });
    expect(ptts).toHaveLength(2);
    expect(ptts[0]).toBeCloseTo(150, 0);
  });
});

describe('estimateBloodPressure', () => {
  it('returns null for empty PTTs', () => {
    expect(estimateBloodPressure([])).toBeNull();
  });

  it('returns null for out-of-range PTT', () => {
    expect(estimateBloodPressure([10])).toBeNull(); // too short
    expect(estimateBloodPressure([600])).toBeNull(); // too long
  });

  it('estimates BP from uncalibrated PTTs', () => {
    const ptts = Array.from({ length: 30 }, () => 200 + (Math.random() - 0.5) * 10);
    const result = estimateBloodPressure(ptts);
    expect(result).not.toBeNull();
    expect(result!.systolic).toBeGreaterThan(70);
    expect(result!.systolic).toBeLessThan(220);
    expect(result!.diastolic).toBeGreaterThan(40);
    expect(result!.diastolic).toBeLessThan(130);
    expect(result!.diastolic).toBeLessThan(result!.systolic);
    expect(result!.calibrated).toBe(false);
    expect(result!.disclaimer).toContain('NOT a medical device');
  });

  it('MAP is between diastolic and systolic', () => {
    const result = estimateBloodPressure([180, 185, 190, 175, 180]);
    expect(result).not.toBeNull();
    expect(result!.map).toBeGreaterThanOrEqual(result!.diastolic);
    expect(result!.map).toBeLessThanOrEqual(result!.systolic);
  });

  it('calibration adjusts estimates', () => {
    const ptts = Array.from({ length: 20 }, () => 200);
    const cal: BPCalibration = {
      systolic: 130,
      diastolic: 85,
      ptt: 200,
      timestamp: Date.now(),
    };

    const uncalibrated = estimateBloodPressure(ptts);
    const calibrated = estimateBloodPressure(ptts, cal);

    expect(calibrated).not.toBeNull();
    expect(calibrated!.calibrated).toBe(true);
    expect(calibrated!.systolic).toBe(130);
    expect(calibrated!.diastolic).toBe(85);
    expect(calibrated!.confidence).toBeGreaterThan(uncalibrated!.confidence);
  });

  it('confidence increases with more data', () => {
    const few = estimateBloodPressure([200, 200, 200, 200, 200]);
    const many = estimateBloodPressure(Array(60).fill(200));
    expect(many!.confidence).toBeGreaterThan(few!.confidence);
  });

  it('confidence decreases with high variance', () => {
    const stable = estimateBloodPressure(Array(30).fill(200));
    const noisy = estimateBloodPressure(Array.from({ length: 30 }, () => 150 + Math.random() * 100));
    expect(stable!.confidence).toBeGreaterThanOrEqual(noisy!.confidence);
  });

  it('shorter PTT → higher BP (inverse relationship)', () => {
    const shortPTT = estimateBloodPressure(Array(20).fill(120));
    const longPTT = estimateBloodPressure(Array(20).fill(300));
    expect(shortPTT!.systolic).toBeGreaterThan(longPTT!.systolic);
  });

  it('handles single PTT value', () => {
    const result = estimateBloodPressure([200]);
    expect(result).not.toBeNull();
    expect(result!.systolic).toBeGreaterThan(0);
  });

  it('always includes timestamp and disclaimer', () => {
    const result = estimateBloodPressure([200]);
    expect(result!.timestamp).toBeGreaterThan(0);
    expect(result!.disclaimer.length).toBeGreaterThan(50);
  });

  it('handles PTTs that are all the same value (zero CV)', () => {
    const result = estimateBloodPressure([200, 200, 200, 200]);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.confidence)).toBe(true);
  });

  it('returns null for PTTs all out of range', () => {
    expect(estimateBloodPressure([10, 10, 10])).toBeNull();
    expect(estimateBloodPressure([1000, 1000, 1000])).toBeNull();
  });

  it('produces finite values for edge-case PTT near min bound', () => {
    const result = estimateBloodPressure([51, 52, 53]);
    if (result) {
      expect(Number.isFinite(result.systolic)).toBe(true);
      expect(Number.isFinite(result.diastolic)).toBe(true);
      expect(Number.isFinite(result.confidence)).toBe(true);
    }
  });
});
