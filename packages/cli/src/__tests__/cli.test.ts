import { parseWorkoutDSL } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { buildConformanceFixture, dslToHrProfile, encodeHrPacket, parseArgv, workoutToHrProfile } from '../index.js';

describe('parseArgv', () => {
  it('parses positional + flags', () => {
    const r = parseArgv(['simulate', '--workout', 'tabata.dsl', '--rate', '4']);
    expect(r.command).toBe('simulate');
    expect(r.flags.workout).toBe('tabata.dsl');
    expect(r.flags.rate).toBe('4');
  });
  it('handles --key=value', () => {
    const r = parseArgv(['x', '--port=9999']);
    expect(r.flags.port).toBe('9999');
  });
  it('handles boolean flags', () => {
    const r = parseArgv(['x', '--verbose']);
    expect(r.flags.verbose).toBe(true);
  });
  it('returns empty for no argv', () => {
    expect(parseArgv([])).toEqual({ command: '', flags: {}, positional: [] });
  });
});

describe('encodeHrPacket', () => {
  it('encodes HR-only with flags=0', () => {
    const p = encodeHrPacket(75);
    expect(Array.from(p)).toEqual([0x00, 75]);
  });
  it('encodes HR with RR (1024 ticks per second)', () => {
    const p = encodeHrPacket(75, [1000]);
    expect(p[0]).toBe(0x10);
    expect(p[1]).toBe(75);
    // 1000 ms × 1024/1000 = 1024 ticks → 0x0400
    expect(p[2]).toBe(0x00);
    expect(p[3]).toBe(0x04);
  });
  it('clamps HR to 0..255', () => {
    expect(encodeHrPacket(300)[1]).toBe(255);
    expect(encodeHrPacket(-1)[1]).toBe(0);
  });
});

describe('workoutToHrProfile', () => {
  it('produces one sample per second of total duration', () => {
    const p = parseWorkoutDSL('name: Easy\nwarmup 10 @zone 1\nwork 20 @zone 4');
    const prof = workoutToHrProfile(p, { maxHR: 200 });
    expect(prof.length).toBe(30);
    expect(prof[prof.length - 1]!.hr).toBeGreaterThan(prof[0]!.hr);
  });
  it('dslToHrProfile is the same for parsed text', () => {
    const dsl = 'name: Easy\nwork 5 @zone 2';
    expect(dslToHrProfile(dsl).length).toBe(5);
  });
  it('handles HR-range targets', () => {
    const p = parseWorkoutDSL('name: T\nwork 10 @hr 150-160');
    const prof = workoutToHrProfile(p);
    const last = prof[prof.length - 1]!.hr;
    expect(last).toBeGreaterThanOrEqual(140);
    expect(last).toBeLessThanOrEqual(160);
  });
});

describe('buildConformanceFixture', () => {
  it('produces a v1 fixture with expected shape', () => {
    const fx = buildConformanceFixture({
      device: 'Polar H10',
      service: '180D',
      characteristic: '2A37',
      notifications: [{ at_ms: 0, bytes_hex: '004B' }],
    }) as { schema_version: number; service: string; notifications: unknown[] };
    expect(fx.schema_version).toBe(1);
    expect(fx.service).toBe('180d');
    expect(fx.notifications).toHaveLength(1);
  });
});
