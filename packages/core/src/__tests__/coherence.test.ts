// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bpmFromHz, coherenceScore } from '../coherence.js';

// Generate a synthetic RR series with a strong sinusoidal component at target Hz.
function syntheticRR(durSec: number, targetHz: number, amplitudeMs = 60, baseRR = 1000): number[] {
  const rr: number[] = [];
  let t = 0;
  while (t < durSec) {
    const v = baseRR + amplitudeMs * Math.sin(2 * Math.PI * targetHz * t);
    rr.push(v);
    t += v / 1000;
  }
  return rr;
}

describe('coherence', () => {
  it('returns 0 for too-short input', () => {
    expect(coherenceScore([800, 810, 790]).score).toBe(0);
  });

  it('locks high score on a 0.1 Hz sinusoid', () => {
    const rr = syntheticRR(180, 0.1, 80);
    const r = coherenceScore(rr);
    expect(r.score).toBeGreaterThan(0.4);
    expect(r.inBand).toBe(true);
  });

  it('produces low coherence on white-noise RR', () => {
    const rr: number[] = [];
    for (let i = 0; i < 200; i++) rr.push(900 + (Math.random() - 0.5) * 100);
    const r = coherenceScore(rr);
    expect(r.score).toBeLessThan(0.4);
  });

  it('peak shifts when target shifts', () => {
    const rr = syntheticRR(180, 0.13, 80);
    const r = coherenceScore(rr, { targetHz: 0.13 });
    expect(Math.abs(r.peakHz - 0.13)).toBeLessThan(0.025);
    expect(r.inBand).toBe(true);
  });

  it('bpmFromHz converts correctly', () => {
    expect(bpmFromHz(0.1)).toBeCloseTo(6, 5);
    expect(bpmFromHz(0.083)).toBeCloseTo(4.98, 2);
  });
});
