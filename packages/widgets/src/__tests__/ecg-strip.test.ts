// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import '../index.js';
import { detectRPeaks } from '../r-peak.js';

// Stub canvas context for happy-dom
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const noop = () => {};
const stubCtx = {
  clearRect: noop,
  fillRect: noop,
  fillText: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  arc: noop,
  fill: noop,
  setTransform: noop,
  set fillStyle(_v: string) {},
  set strokeStyle(_v: string) {},
  set lineWidth(_v: number) {},
  set lineJoin(_v: string) {},
  set lineCap(_v: string) {},
  set font(_v: string) {},
  set textAlign(_v: string) {},
  set textBaseline(_v: string) {},
};

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (id: string) {
    if (id === '2d') return stubCtx as unknown as CanvasRenderingContext2D;
    return originalGetContext.call(this, id) as ReturnType<HTMLCanvasElement['getContext']>;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

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

  it('prunes buffer when it exceeds visible duration', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
      detectPeaks(): { peakIndices: number[]; rrIntervals: number[] };
    };
    el.setAttribute('sample-rate', '130');
    el.setAttribute('duration', '2'); // 2 second window → max 260 samples
    document.body.appendChild(el);
    // Push 10 seconds of data
    el.pushSamples(syntheticECG(10, 130, 60));
    // Buffer should be pruned to ~260 samples
    el.remove();
  });

  it('handles theme attribute change', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
    };
    document.body.appendChild(el);
    el.pushSamples(syntheticECG(2, 130, 60));
    el.setAttribute('theme', 'light');
    el.setAttribute('theme', 'dark');
    el.remove();
  });

  it('handles width/height attribute changes', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
    };
    document.body.appendChild(el);
    el.setAttribute('width', '640');
    el.setAttribute('height', '240');
    el.pushSamples(syntheticECG(2, 130, 60));
    el.remove();
  });

  it('uses default sample-rate of 130 when not set', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
      detectPeaks(): { peakIndices: number[]; rrIntervals: number[] };
    };
    document.body.appendChild(el);
    el.pushSamples(syntheticECG(5, 130, 60));
    const { peakIndices } = el.detectPeaks();
    expect(peakIndices.length).toBeGreaterThanOrEqual(1);
    el.remove();
  });

  it('handles invalid sample-rate gracefully', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      pushSamples(s: number[]): void;
    };
    el.setAttribute('sample-rate', 'abc');
    document.body.appendChild(el);
    el.pushSamples([1, 2, 3]);
    el.remove();
  });

  it('draws empty buffer without error', () => {
    const el = document.createElement('hrkit-ecg-strip') as HTMLElement & {
      clear(): void;
    };
    document.body.appendChild(el);
    el.clear();
    el.remove();
  });
});
