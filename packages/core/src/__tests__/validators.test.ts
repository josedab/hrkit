import { describe, it, expect } from 'vitest';
import { validateHRPacket } from '../validators.js';
import type { HRPacket } from '../types.js';

function pkt(overrides: Partial<HRPacket> = {}): HRPacket {
  return { timestamp: 1000, hr: 72, rrIntervals: [833], contactDetected: true, ...overrides };
}

describe('validateHRPacket', () => {
  it('passes valid packet with defaults', () => {
    const result = validateHRPacket(pkt());
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns on HR below range', () => {
    const result = validateHRPacket(pkt({ hr: 20 }));
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('HR 20');
  });

  it('warns on HR above range', () => {
    const result = validateHRPacket(pkt({ hr: 300 }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('HR 300');
  });

  it('warns on RR below range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [100] }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('RR');
    expect(result.warnings[0]).toContain('100');
  });

  it('warns on RR above range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [2500] }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('RR');
  });

  it('accumulates multiple warnings', () => {
    const result = validateHRPacket(pkt({ hr: 10, rrIntervals: [50, 3000] }));
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(3); // HR + 2 RR
  });

  it('accepts custom HR range', () => {
    const result = validateHRPacket(pkt({ hr: 20 }), { hrRange: [10, 50] });
    expect(result.valid).toBe(true);
  });

  it('accepts custom RR range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [100] }), { rrRange: [50, 150] });
    expect(result.valid).toBe(true);
  });

  it('passes with empty RR intervals', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [] }));
    expect(result.valid).toBe(true);
  });

  it('boundary: HR at exact range limits passes', () => {
    expect(validateHRPacket(pkt({ hr: 30 })).valid).toBe(true);
    expect(validateHRPacket(pkt({ hr: 250 })).valid).toBe(true);
  });

  it('boundary: RR at exact range limits passes', () => {
    expect(validateHRPacket(pkt({ rrIntervals: [200] })).valid).toBe(true);
    expect(validateHRPacket(pkt({ rrIntervals: [2000] })).valid).toBe(true);
  });
});
