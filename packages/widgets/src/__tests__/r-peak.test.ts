import { describe, expect, it } from 'vitest';
import { detectRPeaks } from '../r-peak.js';

function generateSyntheticECG(hr: number, fs: number, durationSec: number): number[] {
  const n = Math.floor(fs * durationSec);
  const samplesPerBeat = Math.floor(fs * (60 / hr));
  const signal: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const posInBeat = i % samplesPerBeat;
    // Simulate a QRS complex: a sharp peak near the middle of each beat
    const qrsCenter = Math.floor(samplesPerBeat * 0.4);
    const dist = Math.abs(posInBeat - qrsCenter);
    if (dist < 3) {
      // Sharp R-peak
      signal[i] = 1000 * Math.exp(-dist * dist);
    } else if (dist < 8) {
      // Small surrounding wave
      signal[i] = 50 * Math.exp(-dist * 0.5);
    } else {
      // Baseline with noise
      signal[i] = (Math.random() - 0.5) * 10;
    }
  }
  return signal;
}

describe('detectRPeaks', () => {
  it('returns empty for very short signals', () => {
    const result = detectRPeaks([1, 2, 3], { fs: 130 });
    expect(result.peakIndices).toEqual([]);
    expect(result.rrIntervals).toEqual([]);
  });

  it('returns empty for signals shorter than 0.5s', () => {
    const fs = 130;
    const signal = new Array(Math.floor(fs * 0.4)).fill(0);
    const result = detectRPeaks(signal, { fs });
    expect(result.peakIndices).toEqual([]);
    expect(result.rrIntervals).toEqual([]);
  });

  it('detects peaks in a synthetic 60 BPM ECG', () => {
    const hr = 60;
    const fs = 130;
    const durationSec = 5;
    const signal = generateSyntheticECG(hr, fs, durationSec);
    const result = detectRPeaks(signal, { fs });

    // 60 BPM over 5s ≈ 5 beats → ~4 RR intervals
    expect(result.peakIndices.length).toBeGreaterThanOrEqual(3);
    expect(result.rrIntervals.length).toBe(result.peakIndices.length - 1);

    // Each RR interval should be approximately 1000ms (± 200ms tolerance)
    for (const rr of result.rrIntervals) {
      expect(rr).toBeGreaterThan(800);
      expect(rr).toBeLessThan(1200);
    }
  });

  it('detects higher rate in a 120 BPM signal', () => {
    const hr = 120;
    const fs = 130;
    const durationSec = 5;
    const signal = generateSyntheticECG(hr, fs, durationSec);
    const result = detectRPeaks(signal, { fs });

    // 120 BPM → ~500ms RR intervals
    expect(result.peakIndices.length).toBeGreaterThanOrEqual(6);
    for (const rr of result.rrIntervals) {
      expect(rr).toBeGreaterThan(350);
      expect(rr).toBeLessThan(700);
    }
  });

  it('uses default fs=130 when no options provided', () => {
    const signal = generateSyntheticECG(60, 130, 3);
    const result = detectRPeaks(signal);
    expect(result.peakIndices.length).toBeGreaterThanOrEqual(1);
  });

  it('respects custom refractory period', () => {
    const signal = generateSyntheticECG(60, 130, 3);
    const normal = detectRPeaks(signal, { fs: 130, refractorySec: 0.2 });
    const long = detectRPeaks(signal, { fs: 130, refractorySec: 1.5 });
    // Longer refractory → fewer or equal peaks
    expect(long.peakIndices.length).toBeLessThanOrEqual(normal.peakIndices.length);
  });

  it('returns RR intervals length = peakIndices length - 1', () => {
    const signal = generateSyntheticECG(80, 130, 4);
    const result = detectRPeaks(signal, { fs: 130 });
    if (result.peakIndices.length > 0) {
      expect(result.rrIntervals.length).toBe(result.peakIndices.length - 1);
    }
  });

  it('returns empty arrays for flat signal', () => {
    const signal = new Array(260).fill(0); // 2s of zeros at 130 Hz
    const result = detectRPeaks(signal, { fs: 130 });
    expect(result.peakIndices).toEqual([]);
    expect(result.rrIntervals).toEqual([]);
  });
});
