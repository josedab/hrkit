import { ParseError } from '@hrkit/core';
import type { ACCPacket, ACCSample, ECGPacket } from './types.js';

// ── PMD Measurement Types ───────────────────────────────────────────────

const PMD_MEASUREMENT_ECG = 0x00;
const PMD_MEASUREMENT_ACC = 0x02;

// ── PMD Control Point Commands ──────────────────────────────────────────

const PMD_CP_GET_MEASUREMENT_SETTINGS = 0x01;
const PMD_CP_START_MEASUREMENT = 0x02;
const PMD_CP_STOP_MEASUREMENT = 0x03;

/**
 * Build a PMD control point command to start ECG streaming.
 * Configures the Polar device for 130Hz sampling at 14-bit resolution.
 *
 * @returns Uint8Array command to write to the PMD Control Point characteristic.
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
 * Build a PMD control point command to start accelerometer streaming.
 * Configures 16-bit resolution and 8G range.
 *
 * @param sampleRate - Sampling rate in Hz. Default: 25. Supports 25, 50, 100, 200.
 * @returns Uint8Array command to write to the PMD Control Point characteristic.
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
 * Build a PMD control point command to stop a measurement by type ID.
 *
 * @param measurementType - PMD measurement type constant (e.g., `PMD_MEASUREMENT_ECG`).
 * @returns Uint8Array command to write to the PMD Control Point characteristic.
 */
export function buildStopCommand(measurementType: number): Uint8Array {
  return new Uint8Array([PMD_CP_STOP_MEASUREMENT, measurementType]);
}

/** Stop ECG streaming. Shorthand for `buildStopCommand(PMD_MEASUREMENT_ECG)`. */
export function buildStopECGCommand(): Uint8Array {
  return buildStopCommand(PMD_MEASUREMENT_ECG);
}

/** Stop accelerometer streaming. Shorthand for `buildStopCommand(PMD_MEASUREMENT_ACC)`. */
export function buildStopACCCommand(): Uint8Array {
  return buildStopCommand(PMD_MEASUREMENT_ACC);
}

/**
 * Build a command to query a device's supported measurement settings.
 *
 * @param measurementType - PMD measurement type constant (e.g., `PMD_MEASUREMENT_ECG`).
 * @returns Uint8Array command to write to the PMD Control Point characteristic.
 */
export function buildGetSettingsCommand(measurementType: number): Uint8Array {
  return new Uint8Array([PMD_CP_GET_MEASUREMENT_SETTINGS, measurementType]);
}

// ── PMD Data Parsing ────────────────────────────────────────────────────

/**
 * Parse a PMD ECG data notification from the PMD Data characteristic.
 * Extracts 14-bit signed samples in microvolts at 130Hz.
 *
 * @param data - Raw DataView from PMD Data characteristic notification.
 * @returns Parsed {@link ECGPacket} with timestamp, samples, and sample rate.
 *
 * @example
 * ```typescript
 * const ecg = parseECGData(dataView);
 * console.log(`${ecg.samples.length} ECG samples at ${ecg.sampleRate}Hz`);
 * ```
 */
export function parseECGData(data: DataView): ECGPacket {
  if (data.byteLength < 10) {
    throw new ParseError(`PMD ECG data too short: need at least 10 bytes for header, got ${data.byteLength}`);
  }
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
 * Parse a PMD accelerometer data notification from the PMD Data characteristic.
 * Extracts 3-axis (x/y/z) int16 samples in milliG (mG).
 *
 * @param data - Raw DataView from PMD Data characteristic notification.
 * @param sampleRate - Expected sample rate. Default: 25Hz. Must match the rate used in `buildStartACCCommand`.
 * @returns Parsed {@link ACCPacket} with timestamp, 3-axis samples, and sample rate.
 *
 * @example
 * ```typescript
 * const acc = parseACCData(dataView, 50);
 * for (const { x, y, z } of acc.samples) {
 *   console.log(`ACC: x=${x} y=${y} z=${z} mG`);
 * }
 * ```
 */
export function parseACCData(data: DataView, sampleRate: 25 | 50 | 100 | 200 = 25): ACCPacket {
  if (data.byteLength < 10) {
    throw new ParseError(`PMD ACC data too short: need at least 10 bytes for header, got ${data.byteLength}`);
  }
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
/**
 * Parsed response from the Polar PMD Control Point characteristic.
 * Returned after writing a command (start, stop, or get settings).
 */
export interface PMDControlResponse {
  opCode: number;
  measurementType: number;
  status: number;
  success: boolean;
  parameters: Uint8Array;
}

/**
 * Parse a PMD control point response.
 *
 * @param data - Raw DataView from PMD Control Point notification.
 * @returns Parsed {@link PMDControlResponse} with opCode, status, and parameters.
 */
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
