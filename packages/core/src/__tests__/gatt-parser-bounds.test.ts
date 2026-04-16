import { describe, expect, it } from 'vitest';
import { ParseError } from '../errors.js';
import { parseHeartRate } from '../gatt-parser.js';

function _buildHRData(options: {
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

describe('parseHeartRate — bounds checking', () => {
  it('throws ParseError on empty buffer', () => {
    const data = new DataView(new ArrayBuffer(0));
    expect(() => parseHeartRate(data)).toThrow(ParseError);
    expect(() => parseHeartRate(data)).toThrow('at least 2 bytes');
  });

  it('throws ParseError on 1-byte buffer', () => {
    const data = new DataView(new Uint8Array([0x00]).buffer);
    expect(() => parseHeartRate(data)).toThrow(ParseError);
    expect(() => parseHeartRate(data)).toThrow('at least 2 bytes');
  });

  it('throws ParseError when 16-bit HR flag set but buffer too short', () => {
    // Flags indicate 16-bit HR but only 2 bytes total (flags + 1 byte)
    const flags = 0x01; // 16-bit HR
    const data = new DataView(new Uint8Array([flags, 72]).buffer);
    expect(() => parseHeartRate(data)).toThrow(ParseError);
    expect(() => parseHeartRate(data)).toThrow('truncated');
  });

  it('throws ParseError when energy flag set but buffer too short', () => {
    // Flags: 8-bit HR + energy expended, but only flags + HR byte
    const flags = 0x08 | 0x04 | 0x02; // energy + contact
    const data = new DataView(new Uint8Array([flags, 72]).buffer);
    expect(() => parseHeartRate(data)).toThrow(ParseError);
    expect(() => parseHeartRate(data)).toThrow('truncated');
  });

  it('ParseError is catchable as HRKitError', () => {
    const data = new DataView(new ArrayBuffer(0));
    try {
      parseHeartRate(data);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
    }
  });

  it('still parses valid minimal buffer (flags + 8-bit HR)', () => {
    const data = new DataView(new Uint8Array([0x06, 72]).buffer); // contact supported + detected
    const result = parseHeartRate(data, 5000);
    expect(result.hr).toBe(72);
    expect(result.contactDetected).toBe(true);
    expect(result.timestamp).toBe(5000);
  });

  it('handles RR flag with no actual RR data gracefully', () => {
    // RR flag set but no bytes remaining for RR values
    const flags = 0x10 | 0x06; // RR + contact
    const data = new DataView(new Uint8Array([flags, 72]).buffer);
    const result = parseHeartRate(data);
    expect(result.hr).toBe(72);
    expect(result.rrIntervals).toEqual([]);
  });

  it('handles odd trailing byte in RR section', () => {
    // RR flag set with 3 extra bytes (1 complete RR + 1 trailing)
    const flags = 0x10 | 0x06;
    const data = new DataView(new Uint8Array([flags, 72, 0x34, 0x03, 0xff]).buffer);
    const result = parseHeartRate(data);
    expect(result.rrIntervals).toHaveLength(1);
  });
});
