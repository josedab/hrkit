import type { ACCPacket, ACCSample, ECGPacket } from './types.js';

// ── PMD Measurement Types ───────────────────────────────────────────────

const PMD_MEASUREMENT_ECG = 0x00;
const PMD_MEASUREMENT_ACC = 0x02;

// ── PMD Control Point Commands ──────────────────────────────────────────

const PMD_CP_GET_MEASUREMENT_SETTINGS = 0x01;
const PMD_CP_START_MEASUREMENT = 0x02;
const PMD_CP_STOP_MEASUREMENT = 0x03;

/**
 * Build a PMD control point command to start ECG streaming at 130Hz.
 */
export function buildStartECGCommand(): Uint8Array {
  return new Uint8Array([
    PMD_CP_START_MEASUREMENT,
    PMD_MEASUREMENT_ECG,
    0x00, // setting type: sample rate
    0x01, // array count
    0x82, // 130 as little-endian uint16
    0x00,
    0x01, // setting type: resolution
    0x01, // array count
    0x0e, // 14 bits
    0x00,
  ]);
}

/**
 * Build a PMD control point command to start ACC streaming.
 */
export function buildStartACCCommand(sampleRate: 25 | 50 | 100 | 200 = 25): Uint8Array {
  const rateLo = sampleRate & 0xff;
  const rateHi = (sampleRate >> 8) & 0xff;

  return new Uint8Array([
    PMD_CP_START_MEASUREMENT,
    PMD_MEASUREMENT_ACC,
    0x00, // setting type: sample rate
    0x01,
    rateLo,
    rateHi,
    0x01, // setting type: resolution
    0x01,
    0x10, // 16 bits
    0x00,
    0x02, // setting type: range
    0x01,
    0x08, // 8G
    0x00,
  ]);
}

/**
 * Build a PMD control point command to stop a measurement.
 */
export function buildStopCommand(measurementType: number): Uint8Array {
  return new Uint8Array([PMD_CP_STOP_MEASUREMENT, measurementType]);
}

export function buildStopECGCommand(): Uint8Array {
  return buildStopCommand(PMD_MEASUREMENT_ECG);
}

export function buildStopACCCommand(): Uint8Array {
  return buildStopCommand(PMD_MEASUREMENT_ACC);
}

/**
 * Build a command to query measurement settings.
 */
export function buildGetSettingsCommand(measurementType: number): Uint8Array {
  return new Uint8Array([PMD_CP_GET_MEASUREMENT_SETTINGS, measurementType]);
}

// ── PMD Data Parsing ────────────────────────────────────────────────────

/**
 * Parse PMD ECG data notification.
 * Frame format:
 *   byte 0:   measurement type (0x00 = ECG)
 *   bytes 1-8: timestamp (uint64 LE, microseconds)
 *   byte 9:   frame type
 *   bytes 10+: samples (3 bytes each, 14-bit signed, little-endian)
 */
export function parseECGData(data: DataView): ECGPacket {
  const timestamp = readUint64LE(data, 1);
  const frameType = data.getUint8(9);

  const samples: number[] = [];

  if (frameType === 0) {
    // Delta frame: samples as 3-byte little-endian signed integers (14-bit)
    let offset = 10;
    while (offset + 2 < data.byteLength) {
      const raw = data.getUint8(offset) | (data.getUint8(offset + 1) << 8) | (data.getUint8(offset + 2) << 16);

      // Sign-extend from 24-bit to 32-bit
      const signed = raw > 0x7fffff ? raw - 0x1000000 : raw;
      samples.push(signed);
      offset += 3;
    }
  }

  return { timestamp, samples, sampleRate: 130 };
}

/**
 * Parse PMD ACC data notification.
 * Frame format:
 *   byte 0:   measurement type (0x02 = ACC)
 *   bytes 1-8: timestamp (uint64 LE, microseconds)
 *   byte 9:   frame type
 *   bytes 10+: samples (6 bytes each: x, y, z as int16 LE)
 */
export function parseACCData(data: DataView, sampleRate: 25 | 50 | 100 | 200 = 25): ACCPacket {
  const timestamp = readUint64LE(data, 1);
  const frameType = data.getUint8(9);

  const samples: ACCSample[] = [];

  if (frameType === 0) {
    let offset = 10;
    while (offset + 5 < data.byteLength) {
      const x = data.getInt16(offset, true);
      const y = data.getInt16(offset + 2, true);
      const z = data.getInt16(offset + 4, true);
      samples.push({ x, y, z });
      offset += 6;
    }
  }

  return { timestamp, samples, sampleRate };
}

/**
 * Parse a PMD control point response.
 * Response format:
 *   byte 0: response code (0xF0)
 *   byte 1: op code echoed
 *   byte 2: measurement type
 *   byte 3: status (0x00 = success)
 *   bytes 4+: parameters (if GET_MEASUREMENT_SETTINGS)
 */
export interface PMDControlResponse {
  opCode: number;
  measurementType: number;
  status: number;
  success: boolean;
  parameters: Uint8Array;
}

export function parsePMDControlResponse(data: DataView): PMDControlResponse {
  const opCode = data.getUint8(1);
  const measurementType = data.getUint8(2);
  const status = data.getUint8(3);

  const parameters = new Uint8Array(data.buffer, data.byteOffset + 4, Math.max(0, data.byteLength - 4));

  return {
    opCode,
    measurementType,
    status,
    success: status === 0x00,
    parameters,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function readUint64LE(view: DataView, offset: number): number {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  // JavaScript can't represent full uint64, but timestamp fits in Number.MAX_SAFE_INTEGER
  return lo + hi * 0x100000000;
}

export { PMD_MEASUREMENT_ACC, PMD_MEASUREMENT_ECG };
