import type { HRConnection } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';
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
import { POLAR_H9, POLAR_H10, POLAR_OH1 } from '../profiles.js';

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
