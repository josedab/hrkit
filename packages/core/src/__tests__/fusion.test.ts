import { describe, expect, it } from 'vitest';
import {
  encodeRequestControl,
  encodeReset,
  encodeSetIndoorBikeSimulation,
  encodeSetTargetPower,
  fuseStreams,
  MemoryGlucoseSource,
} from '../fusion.js';

describe('FTMS encoders', () => {
  it('encodes request-control + reset as single opcodes', () => {
    expect(Array.from(encodeRequestControl())).toEqual([0x00]);
    expect(Array.from(encodeReset())).toEqual([0x01]);
  });
  it('encodes target power as little-endian int16', () => {
    expect(Array.from(encodeSetTargetPower(250))).toEqual([0x05, 0xfa, 0x00]);
    expect(Array.from(encodeSetTargetPower(-100))).toEqual([0x05, 0x9c, 0xff]);
  });
  it('clamps target power to int16 range', () => {
    expect(Array.from(encodeSetTargetPower(99999))).toEqual([0x05, 0xff, 0x7f]);
  });
  it('encodes simulation params with grade in 0.01% units', () => {
    const buf = encodeSetIndoorBikeSimulation({
      gradePercent: 4.5,
      windSpeed: 0,
      rollingResistance: 0.004,
      windResistance: 0.51,
    });
    expect(buf[0]).toBe(0x11);
    // grade 4.5 * 100 = 450 = 0x01C2
    expect(buf[3]).toBe(0xc2);
    expect(buf[4]).toBe(0x01);
  });
});

describe('MemoryGlucoseSource', () => {
  it('emits readings to subscribers', async () => {
    const source = new MemoryGlucoseSource([
      { mgdl: 100, timestamp: 1 },
      { mgdl: 110, timestamp: 2 },
    ]);
    const received: number[] = [];
    source.subscribe((r) => received.push(r.mgdl));
    await source.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toEqual([100, 110]);
  });
});

describe('fuseStreams', () => {
  it('joins HR + power + glucose with forward-fill', () => {
    const fused = fuseStreams({
      hr: [
        { timestamp: 0, hr: 120 },
        { timestamp: 1000, hr: 130 },
      ],
      power: [{ timestamp: 200, powerWatts: 250 }],
      glucose: [{ mgdl: 110, timestamp: 0 }],
    });
    const at1000 = fused.find((s) => s.timestamp === 1000);
    expect(at1000?.hr).toBe(130);
    expect(at1000?.powerWatts).toBe(250);
    expect(at1000?.glucoseMgdl).toBe(110);
  });
  it('drops stale carriers beyond the window', () => {
    const fused = fuseStreams(
      {
        hr: [
          { timestamp: 0, hr: 100 },
          { timestamp: 60_000, hr: 110 },
        ],
      },
      5_000,
    );
    const last = fused[fused.length - 1];
    expect(last?.hr).toBe(110);
  });
});
