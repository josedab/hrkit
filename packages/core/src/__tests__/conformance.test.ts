import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  CONFORMANCE_FIXTURE_SCHEMA,
  type ConformanceFixture,
  hexToDataView,
  recordNotification,
  verifyFixture,
} from '../conformance.js';

describe('hex helpers', () => {
  it('hexToDataView round-trips bytesToHex', () => {
    const hex = '0a1bff7c';
    const view = hexToDataView(hex);
    expect(bytesToHex(view)).toBe(hex);
  });
  it('handles spaces', () => {
    const view = hexToDataView('0a 1b ff 7c');
    expect(view.byteLength).toBe(4);
  });
  it('throws on odd length', () => {
    expect(() => hexToDataView('abc')).toThrow();
  });
  it('throws on non-hex chars', () => {
    expect(() => hexToDataView('zzzz')).toThrow();
  });
});

describe('recordNotification', () => {
  it('encodes a Uint8Array to hex', () => {
    const note = recordNotification(new Uint8Array([0x10, 0x4b]), 5000);
    expect(note.hex).toBe('104b');
    expect(note.timestamp).toBe(5000);
  });
});

describe('verifyFixture', () => {
  // Build a tiny HR packet manually:
  //   flags=0x10 (RR present, no contact), hr=75 (uint8), one RR = 1024 (= 1000ms)
  // bytes: [0x10, 0x4b, 0x00, 0x04]
  const fixture: ConformanceFixture = {
    schemaVersion: CONFORMANCE_FIXTURE_SCHEMA,
    device: {
      brand: 'Test',
      model: 'Synthetic HR',
      serviceUuid: '0000180d-0000-1000-8000-00805f9b34fb',
      characteristicUuid: '00002a37-0000-1000-8000-00805f9b34fb',
    },
    notifications: [
      { timestamp: 1, hex: '104b0004' },
      { timestamp: 2, hex: '00f0' }, // hr=240, no rr, no contact info → contactDetected=true (default)
    ],
    expected: [
      { hr: 75, rrIntervals: [1000] },
      { hr: 240, rrIntervals: [] },
    ],
  };

  it('passes a correctly-built fixture', () => {
    const result = verifyFixture(fixture);
    expect(result.ok).toBe(true);
    expect(result.passed).toBe(2);
    expect(result.failures).toHaveLength(0);
  });

  it('reports failure on hr mismatch', () => {
    const broken: ConformanceFixture = {
      ...fixture,
      expected: [{ hr: 99 }, { hr: 240 }],
    };
    const result = verifyFixture(broken);
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toContain('hr');
  });

  it('reports failure on rr length mismatch', () => {
    const broken: ConformanceFixture = {
      ...fixture,
      expected: [{ rrIntervals: [1000, 1000] }, {}],
    };
    const result = verifyFixture(broken);
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toMatch(/rrIntervals/);
  });

  it('tolerates ±1 ms rounding in rr intervals', () => {
    const tweaked: ConformanceFixture = {
      ...fixture,
      expected: [{ rrIntervals: [1001] }, {}], // off-by-one
    };
    expect(verifyFixture(tweaked).ok).toBe(true);
  });

  it('passes when no expected output supplied', () => {
    const noExpected: ConformanceFixture = { ...fixture, expected: undefined };
    const r = verifyFixture(noExpected);
    expect(r.ok).toBe(true);
    expect(r.passed).toBe(2);
  });

  it('reports decode error on bad hex', () => {
    const bad: ConformanceFixture = {
      ...fixture,
      notifications: [{ timestamp: 1, hex: 'zz' }],
      expected: [{ hr: 0 }],
    };
    const r = verifyFixture(bad);
    expect(r.ok).toBe(false);
    expect(r.failures[0]?.reason).toMatch(/hex/);
  });
});
