import type { HRConnection } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { isPolarConnection } from '../guards.js';
import {
  buildStartACCCommand,
  buildStartECGCommand,
  buildStopACCCommand,
  buildStopECGCommand,
  parseACCData,
  parseECGData,
  parsePMDControlResponse,
} from '../pmd.js';
import { POLAR_H9, POLAR_H10, POLAR_OH1, POLAR_VERITY_SENSE } from '../profiles.js';

describe('PMD commands', () => {
  it('builds ECG start command', () => {
    const cmd = buildStartECGCommand();
    expect(cmd[0]).toBe(0x02); // START_MEASUREMENT
    expect(cmd[1]).toBe(0x00); // ECG type
    expect(cmd).toBeInstanceOf(Uint8Array);
  });

  it('builds ACC start command with default sample rate', () => {
    const cmd = buildStartACCCommand();
    expect(cmd[0]).toBe(0x02); // START_MEASUREMENT
    expect(cmd[1]).toBe(0x02); // ACC type
  });

  it('builds ACC start command with custom sample rate', () => {
    const cmd = buildStartACCCommand(200);
    expect(cmd[0]).toBe(0x02);
    expect(cmd[1]).toBe(0x02);
    // 200 = 0xC8 little-endian
    expect(cmd[4]).toBe(0xc8);
    expect(cmd[5]).toBe(0x00);
  });

  it('builds ECG stop command', () => {
    const cmd = buildStopECGCommand();
    expect(cmd[0]).toBe(0x03); // STOP_MEASUREMENT
    expect(cmd[1]).toBe(0x00); // ECG
  });

  it('builds ACC stop command', () => {
    const cmd = buildStopACCCommand();
    expect(cmd[0]).toBe(0x03);
    expect(cmd[1]).toBe(0x02);
  });
});

describe('parseECGData', () => {
  it('parses ECG data notification', () => {
    // Build a synthetic ECG frame
    const frame = new Uint8Array([
      0x00, // measurement type: ECG
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // timestamp (0)
      0x00, // frame type: 0 (delta)
      // 2 samples, 3 bytes each (signed 24-bit LE)
      0x64,
      0x00,
      0x00, // 100 microvolts
      0x9c,
      0xff,
      0xff, // -100 microvolts (0xFFFF9C)
    ]);

    const data = new DataView(frame.buffer);
    const result = parseECGData(data);

    expect(result.sampleRate).toBe(130);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0]).toBe(100);
    expect(result.samples[1]).toBe(-100);
  });

  it('parses timestamp from ECG data', () => {
    const frame = new Uint8Array([
      0x00,
      0x40,
      0x42,
      0x0f,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // 1000000 microseconds
      0x00,
    ]);

    const data = new DataView(frame.buffer);
    const result = parseECGData(data);

    expect(result.timestamp).toBe(1000000);
  });
});

describe('parseACCData', () => {
  it('parses ACC data notification', () => {
    const frame = new Uint8Array([
      0x02, // measurement type: ACC
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // timestamp
      0x00, // frame type: 0
      // 1 sample: x=100, y=-50, z=1000 (int16 LE)
      0x64,
      0x00, // x = 100
      0xce,
      0xff, // y = -50
      0xe8,
      0x03, // z = 1000
    ]);

    const data = new DataView(frame.buffer);
    const result = parseACCData(data);

    expect(result.sampleRate).toBe(25);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]!.x).toBe(100);
    expect(result.samples[0]!.y).toBe(-50);
    expect(result.samples[0]!.z).toBe(1000);
  });
});

describe('parsePMDControlResponse', () => {
  it('parses success response', () => {
    const frame = new Uint8Array([0xf0, 0x02, 0x00, 0x00]);
    const data = new DataView(frame.buffer);
    const result = parsePMDControlResponse(data);

    expect(result.opCode).toBe(0x02);
    expect(result.measurementType).toBe(0x00);
    expect(result.success).toBe(true);
    expect(result.status).toBe(0x00);
  });

  it('parses error response', () => {
    const frame = new Uint8Array([0xf0, 0x02, 0x00, 0x01]);
    const data = new DataView(frame.buffer);
    const result = parsePMDControlResponse(data);

    expect(result.success).toBe(false);
    expect(result.status).toBe(0x01);
  });

  it('includes extra parameters', () => {
    const frame = new Uint8Array([0xf0, 0x01, 0x00, 0x00, 0xab, 0xcd]);
    const data = new DataView(frame.buffer);
    const result = parsePMDControlResponse(data);

    expect(result.parameters).toHaveLength(2);
    expect(result.parameters[0]).toBe(0xab);
  });
});

describe('isPolarConnection', () => {
  it('returns true for Polar H10 profile', () => {
    const conn = {
      deviceId: 'test',
      deviceName: 'Polar H10',
      profile: POLAR_H10,
    } as HRConnection;

    expect(isPolarConnection(conn)).toBe(true);
  });

  it('returns true for Polar OH1 profile', () => {
    const conn = {
      deviceId: 'test',
      deviceName: 'Polar OH1',
      profile: POLAR_OH1,
    } as HRConnection;

    expect(isPolarConnection(conn)).toBe(true);
  });

  it('returns false for generic HR profile', () => {
    const conn = {
      deviceId: 'test',
      deviceName: 'Generic',
      profile: {
        brand: 'Generic',
        model: 'BLE HR',
        namePrefix: '',
        capabilities: ['heartRate' as const, 'rrIntervals' as const],
        serviceUUIDs: [GATT_HR_SERVICE_UUID],
      },
    } as HRConnection;

    expect(isPolarConnection(conn)).toBe(false);
  });
});

describe('Polar profiles', () => {
  it('H10 supports all capabilities', () => {
    expect(POLAR_H10.capabilities).toContain('ecg');
    expect(POLAR_H10.capabilities).toContain('accelerometer');
    expect(POLAR_H10.capabilities).toContain('heartRate');
    expect(POLAR_H10.capabilities).toContain('rrIntervals');
  });

  it('H9 supports ECG but not accelerometer', () => {
    expect(POLAR_H9.capabilities).toContain('ecg');
    expect(POLAR_H9.capabilities).not.toContain('accelerometer');
  });

  it('OH1 supports accelerometer but not ECG', () => {
    expect(POLAR_OH1.capabilities).toContain('accelerometer');
    expect(POLAR_OH1.capabilities).not.toContain('ecg');
  });
});

describe('isPolarConnection', () => {
  const makeConn = (serviceUUIDs: string[]): HRConnection =>
    ({
      profile: { serviceUUIDs },
    }) as HRConnection;

  it('returns true for a connection with the Polar PMD service UUID', () => {
    const conn = makeConn([GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID]);
    expect(isPolarConnection(conn)).toBe(true);
  });

  it('returns false for a non-Polar connection', () => {
    const conn = makeConn([GATT_HR_SERVICE_UUID]);
    expect(isPolarConnection(conn)).toBe(false);
  });

  it('returns false for empty serviceUUIDs', () => {
    const conn = makeConn([]);
    expect(isPolarConnection(conn)).toBe(false);
  });
});

describe('Polar profile metadata (#13 coverage)', () => {
  // Every Polar profile should agree on brand + PMD service.
  const profiles = [
    { name: 'H10', profile: POLAR_H10, expectECG: true, expectACC: true },
    { name: 'H9', profile: POLAR_H9, expectECG: true, expectACC: false },
    { name: 'OH1', profile: POLAR_OH1, expectECG: false, expectACC: true },
    { name: 'Verity Sense', profile: POLAR_VERITY_SENSE, expectECG: false, expectACC: true },
  ];

  it.each(profiles)('$name has brand, model, and namePrefix set', ({ profile }) => {
    expect(profile.brand).toBe('Polar');
    expect(profile.model).toBeTypeOf('string');
    expect(profile.model.length).toBeGreaterThan(0);
    expect(profile.namePrefix).toBeTypeOf('string');
    expect(profile.namePrefix.length).toBeGreaterThan(0);
  });

  it.each(profiles)('$name advertises HR + PMD service UUIDs', ({ profile }) => {
    expect(profile.serviceUUIDs).toContain(GATT_HR_SERVICE_UUID);
    expect(profile.serviceUUIDs).toContain(POLAR_PMD_SERVICE_UUID);
  });

  it.each(profiles)('$name always includes heartRate + rrIntervals', ({ profile }) => {
    expect(profile.capabilities).toContain('heartRate');
    expect(profile.capabilities).toContain('rrIntervals');
  });

  it.each(profiles)('$name capability list matches the device\u2019s advertised sensors', ({
    profile,
    expectECG,
    expectACC,
  }) => {
    expect(profile.capabilities.includes('ecg')).toBe(expectECG);
    expect(profile.capabilities.includes('accelerometer')).toBe(expectACC);
  });

  it('Verity Sense is distinguishable from OH1 by namePrefix', () => {
    // Both profiles are optical sensors with the same capability set; the
    // deviceName prefix is the only discriminator used for matching.
    expect(POLAR_VERITY_SENSE.namePrefix).not.toBe(POLAR_OH1.namePrefix);
    expect(POLAR_VERITY_SENSE.model).not.toBe(POLAR_OH1.model);
  });
});

describe('isPolarConnection edge cases (#13 coverage)', () => {
  const makeConn = (serviceUUIDs: string[]): HRConnection =>
    ({
      profile: { serviceUUIDs },
    }) as HRConnection;

  it('returns true for a connection carrying the Verity Sense profile', () => {
    const conn = {
      deviceId: 'test',
      deviceName: 'Polar Sense',
      profile: POLAR_VERITY_SENSE,
    } as HRConnection;
    expect(isPolarConnection(conn)).toBe(true);
  });

  it('returns true even when PMD is not the first listed service', () => {
    // Some BLE advertisements reorder services; the guard must not assume position.
    const conn = makeConn([GATT_HR_SERVICE_UUID, 'ffffffff-0000-0000-0000-000000000000', POLAR_PMD_SERVICE_UUID]);
    expect(isPolarConnection(conn)).toBe(true);
  });

  it('returns false for a connection with HR only (no PMD)', () => {
    const conn = makeConn([GATT_HR_SERVICE_UUID]);
    expect(isPolarConnection(conn)).toBe(false);
  });

  it('returns false for a connection advertising an unrelated service', () => {
    const conn = makeConn(['0000180f-0000-1000-8000-00805f9b34fb']); // Battery service
    expect(isPolarConnection(conn)).toBe(false);
  });

  it('is case-sensitive on the PMD UUID (no normalization)', () => {
    // Document current behavior: the guard compares strings, so an uppercase UUID does
    // not match. Callers are expected to normalize before passing in.
    const conn = makeConn([POLAR_PMD_SERVICE_UUID.toUpperCase()]);
    expect(isPolarConnection(conn)).toBe(false);
  });
});
