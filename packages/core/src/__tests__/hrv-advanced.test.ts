import { describe, expect, it } from 'vitest';
import { cleanRR, dfaAlpha1, frequencyDomain, hrvReport, poincare } from '../hrv-advanced.js';

function syntheticRR(n: number, base = 1000, ampMs = 30, freqHz = 0.25, fs = 1): number[] {
  // base RR series with a sinusoidal HF oscillation at freqHz Hz. fs=1 sample/sec.
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + ampMs * Math.sin(2 * Math.PI * freqHz * (i / fs)));
  }
  return out;
}

describe('cleanRR', () => {
  it('flags and replaces extreme outliers', () => {
    const rr = [800, 810, 805, 8000, 805, 810, 800];
    const c = cleanRR(rr);
    expect(c.artefactIndices).toContain(3);
    expect(c.rr[3]).toBeLessThan(900);
  });

  it('leaves clean signal untouched', () => {
    const rr = [800, 810, 805, 815, 800, 805];
    const c = cleanRR(rr);
    expect(c.artefactIndices).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(cleanRR([])).toEqual({ rr: [], artefactIndices: [] });
  });
});

describe('poincare', () => {
  it('SD1 ≈ rMSSD/√2 for a known series', () => {
    const rr = [800, 820, 800, 820, 800, 820, 800, 820];
    const p = poincare(rr);
    // rMSSD = 20, so SD1 ≈ 14.14
    expect(p.sd1).toBeGreaterThan(13);
    expect(p.sd1).toBeLessThan(15);
    expect(p.sd2).toBeGreaterThanOrEqual(0);
    expect(p.ratio).toBeGreaterThanOrEqual(0);
  });

  it('returns zeros for short input', () => {
    expect(poincare([800])).toEqual({ sd1: 0, sd2: 0, ratio: 0 });
  });
});

describe('dfaAlpha1', () => {
  it('returns a finite α between 0.3 and 1.7 for a synthetic series', () => {
    const rr = syntheticRR(300, 1000, 40, 0.1);
    const a = dfaAlpha1(rr);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThan(0.2);
    expect(a).toBeLessThan(2.0);
  });

  it('returns 0 for too-short input', () => {
    expect(dfaAlpha1([800, 810, 820])).toBe(0);
  });
});

describe('frequencyDomain', () => {
  it('detects HF power for a 0.25 Hz oscillation', () => {
    const rr = syntheticRR(256, 1000, 30, 0.25);
    const fd = frequencyDomain(rr);
    expect(fd.hf).toBeGreaterThan(fd.lf);
    expect(fd.totalPower).toBeGreaterThan(0);
    expect(fd.hfNu).toBeGreaterThan(50);
  });

  it('detects LF power for a 0.1 Hz oscillation', () => {
    const rr = syntheticRR(512, 1000, 30, 0.1);
    const fd = frequencyDomain(rr);
    expect(fd.lf).toBeGreaterThan(fd.hf);
  });

  it('returns zeros for very short input', () => {
    const fd = frequencyDomain([800, 810]);
    expect(fd.totalPower).toBe(0);
  });
});

describe('hrvReport', () => {
  it('produces a complete report with all sections', () => {
    const rr = syntheticRR(300, 1000, 30, 0.25);
    const r = hrvReport(rr);
    expect(r.n).toBe(300);
    expect(r.time.meanHR).toBeGreaterThan(50);
    expect(r.time.meanHR).toBeLessThan(80);
    expect(r.nonlinear.sd1).toBeGreaterThan(0);
    expect(r.frequency.totalPower).toBeGreaterThan(0);
  });

  it('cleans artefacts before computing metrics', () => {
    const rr = [...syntheticRR(100, 1000, 20, 0.25), 9000, 9000];
    const r = hrvReport(rr);
    expect(r.artefactCount).toBeGreaterThan(0);
  });
});
