import { describe, it, expect } from 'vitest';
import { parseHeartRate } from '../gatt-parser.js';

function buildHRData(options: {
  hr: number;
  is16Bit?: boolean;
  contactDetected?: boolean;
  contactSupported?: boolean;
  energyExpended?: number;
  rrIntervals?: number[];
}): DataView {
  let flags = 0;
  const parts: number[] = [];

  if (options.is16Bit) flags |= 0x01;
  if (options.contactSupported !== false) flags |= 0x04;
  if (options.contactDetected !== false) flags |= 0x02;
  if (options.energyExpended !== undefined) flags |= 0x08;
  if (options.rrIntervals && options.rrIntervals.length > 0) flags |= 0x10;

  parts.push(flags);

  if (options.is16Bit) {
    parts.push(options.hr & 0xff, (options.hr >> 8) & 0xff);
  } else {
    parts.push(options.hr);
  }

  if (options.energyExpended !== undefined) {
    parts.push(options.energyExpended & 0xff, (options.energyExpended >> 8) & 0xff);
  }

  if (options.rrIntervals) {
    for (const rr of options.rrIntervals) {
      parts.push(rr & 0xff, (rr >> 8) & 0xff);
    }
  }

  const buffer = new Uint8Array(parts);
  return new DataView(buffer.buffer);
}

describe('parseHeartRate', () => {
  it('parses 8-bit HR with no RR intervals', () => {
    const data = buildHRData({ hr: 72 });
    const result = parseHeartRate(data, 1000);

    expect(result.hr).toBe(72);
    expect(result.rrIntervals).toEqual([]);
    expect(result.contactDetected).toBe(true);
    expect(result.timestamp).toBe(1000);
  });

  it('parses 16-bit HR', () => {
    const data = buildHRData({ hr: 300, is16Bit: true });
    const result = parseHeartRate(data);

    expect(result.hr).toBe(300);
  });

  it('parses RR intervals with correct 1/1024s conversion', () => {
    // Raw value 820 in 1/1024s units = 820 * (1000/1024) ≈ 800.78ms
    const data = buildHRData({ hr: 75, rrIntervals: [820, 840] });
    const result = parseHeartRate(data);

    expect(result.rrIntervals).toHaveLength(2);
    expect(result.rrIntervals[0]).toBeCloseTo(820 * (1000 / 1024), 2);
    expect(result.rrIntervals[1]).toBeCloseTo(840 * (1000 / 1024), 2);
  });

  it('handles contact not detected', () => {
    // Contact supported but not detected
    const flags = 0x04; // supported but bit 1 not set
    const buffer = new Uint8Array([flags, 72]);
    const data = new DataView(buffer.buffer);
    const result = parseHeartRate(data);

    expect(result.contactDetected).toBe(false);
  });

  it('handles energy expended field', () => {
    const data = buildHRData({ hr: 80, energyExpended: 1234 });
    const result = parseHeartRate(data);

    expect(result.hr).toBe(80);
    expect(result.energyExpended).toBe(1234);
  });

  it('handles all fields combined', () => {
    const data = buildHRData({
      hr: 165,
      is16Bit: true,
      energyExpended: 500,
      rrIntervals: [820],
    });
    const result = parseHeartRate(data);

    expect(result.hr).toBe(165);
    expect(result.energyExpended).toBe(500);
    expect(result.rrIntervals).toHaveLength(1);
    expect(result.contactDetected).toBe(true);
  });
});
