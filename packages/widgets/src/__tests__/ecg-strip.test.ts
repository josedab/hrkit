// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import '../index.js';
import { detectRPeaks } from '../r-peak.js';

/** Generate a synthetic ECG-like signal with peaks every `bpm` BPM at sample rate `fs`. */
function syntheticECG(seconds: number, fs: number, bpm: number): number[] {
  const n = seconds * fs;
  const periodSamples = Math.floor((60 / bpm) * fs);
  const out: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    // Baseline noise
    out[i] = (Math.random() - 0.5) * 0.05;
    // Add a sharp Gaussian-like R-peak
    const phase = i % periodSamples;
    if (phase < 6) {
      const x = phase - 3;
      out[i] += Math.exp(-(x * x) / 0.5) * 1.0;
    }
  }
  return out;
}

describe('detectRPeaks', () => {
  it('detects ~60 peaks in 60s at 60 BPM', () => {
    const fs = 130;
    const sig = syntheticECG(30, fs, 60);
    const { peakIndices, rrIntervals } = detectRPeaks(sig, { fs });
    expect(peakIndices.length).toBeGreaterThanOrEqual(25);
    expect(peakIndices.length).toBeLessThanOrEqual(35);
    if (rrIntervals.length > 0) {
      const meanRR = rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length;
      expect(meanRR).toBeGreaterThan(800);
      expect(meanRR).toBeLessThan(1200);
    }
  });

  it('returns empty for very short signal', () => {
    expect(detectRPeaks([1, 2, 3], { fs: 130 }).peakIndices).toEqual([]);
  });
});

describe('<hrkit-ecg-strip>', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('hrkit-ecg-strip')).toBeDefined();
  });

  it('accepts pushSamples without throwing', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
      clear(): void;
    };
    document.body.appendChild(el);
    el.setAttribute('sample-rate', '130');
    el.pushSamples(syntheticECG(2, 130, 60));
    el.clear();
    el.remove();
  });

  it('detects peaks via element method', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
      detectPeaks(): { peakIndices: number[]; rrIntervals: number[] };
    };
    el.setAttribute('sample-rate', '130');
    document.body.appendChild(el);
    el.pushSamples(syntheticECG(10, 130, 60));
    const { peakIndices } = el.detectPeaks();
    expect(peakIndices.length).toBeGreaterThan(5);
    el.remove();
  });
});
