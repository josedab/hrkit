import { describe, expect, it } from 'vitest';
import {
  CYCLING_CSC_PROFILE,
  CYCLING_POWER_PROFILE,
  computeCadenceRPM,
  PULSE_OX_PROFILE,
  parseCSC,
  parseCyclingPower,
  parsePulseOxContinuous,
  parseRSC,
  RUNNING_RSC_PROFILE,
  sFloat16,
} from '../sensors.js';

function buf(...bytes: number[]): DataView {
  const arr = new Uint8Array(bytes);
  return new DataView(arr.buffer);
}

describe('parseCyclingPower', () => {
  it('parses minimal frame (flags=0, power only)', () => {
    // flags=0x0000, power=250W (0xFA, 0x00)
    const view = buf(0x00, 0x00, 0xfa, 0x00);
    const p = parseCyclingPower(view, 1000);
    expect(p.power).toBe(250);
    expect(p.pedalPowerBalancePct).toBeUndefined();
  });

  it('parses pedal balance + crank revs', () => {
    // flags = bit0 (balance) + bit5 (crank) = 0x21
    const view = buf(
      0x21,
      0x00, // flags
      0xc8,
      0x00, // power = 200W
      0x80, // balance = 128/2 = 64%
      0x0a,
      0x00, // crank revs = 10
      0x00,
      0x04, // crank event time = 1024 (= 1s)
    );
    const p = parseCyclingPower(view, 0);
    expect(p.power).toBe(200);
    expect(p.pedalPowerBalancePct).toBe(64);
    expect(p.crankRevolutions).toBe(10);
    expect(p.crankEventTime).toBe(1024);
  });
});

describe('computeCadenceRPM', () => {
  it('computes 60 RPM for 1 rev/second', () => {
    const rpm = computeCadenceRPM(
      { crankRevolutions: 0, crankEventTime: 0 },
      { crankRevolutions: 1, crankEventTime: 1024 },
    );
    expect(rpm).toBeCloseTo(60, 0);
  });
  it('handles event time wraparound', () => {
    const rpm = computeCadenceRPM(
      { crankRevolutions: 65535, crankEventTime: 65000 },
      { crankRevolutions: 0, crankEventTime: 488 }, // wrap
    );
    expect(rpm).toBeGreaterThan(0);
  });
  it('returns 0 for no time delta', () => {
    expect(
      computeCadenceRPM({ crankRevolutions: 0, crankEventTime: 100 }, { crankRevolutions: 1, crankEventTime: 100 }),
    ).toBe(0);
  });
});

describe('parseCSC', () => {
  it('parses both wheel and crank fields', () => {
    const view = buf(
      0x03, // flags
      0x10,
      0x00,
      0x00,
      0x00, // wheel revs = 16
      0x00,
      0x04, // wheel event time = 1024
      0x05,
      0x00, // crank revs = 5
      0x00,
      0x02, // crank event time = 512
    );
    const p = parseCSC(view, 0);
    expect(p.wheelRevolutions).toBe(16);
    expect(p.crankRevolutions).toBe(5);
    expect(p.crankEventTime).toBe(512);
  });
});

describe('parseRSC', () => {
  it('parses speed (m/s) and cadence', () => {
    // flags=0x04 (running), speed = 768/256 = 3 m/s, cadence = 180 spm
    const view = buf(0x04, 0x00, 0x03, 0xb4);
    const p = parseRSC(view, 0);
    expect(p.speedMps).toBeCloseTo(3, 5);
    expect(p.cadenceSpm).toBe(180);
    expect(p.isRunning).toBe(true);
  });
});

describe('sFloat16', () => {
  it('decodes 0x0064 as 100', () => {
    expect(sFloat16(0x0064)).toBe(100);
  });
  it('decodes negative exponent', () => {
    // mantissa 100, exponent -1 → 10
    // exp -1 = 0xF in 4 bits → 0xF064
    expect(sFloat16(0xf064)).toBeCloseTo(10, 5);
  });
  it('returns NaN for reserved sentinel', () => {
    expect(Number.isNaN(sFloat16(0x07ff))).toBe(true);
  });
});

describe('parsePulseOxContinuous', () => {
  it('parses SpO2 and pulse rate', () => {
    // flags=0, SpO2=98, PR=72
    const view = buf(0x00, 0x62, 0x00, 0x48, 0x00);
    const p = parsePulseOxContinuous(view, 0);
    expect(p.spo2Pct).toBe(98);
    expect(p.pulseRateBpm).toBe(72);
  });
});

describe('sensor profiles', () => {
  it('exports profile constants with correct capabilities', () => {
    expect(CYCLING_POWER_PROFILE.capabilities).toContain('cyclingPower');
    expect(CYCLING_CSC_PROFILE.capabilities).toContain('cyclingSpeedCadence');
    expect(RUNNING_RSC_PROFILE.capabilities).toContain('runningSpeedCadence');
    expect(PULSE_OX_PROFILE.capabilities).toContain('spo2');
  });
});
