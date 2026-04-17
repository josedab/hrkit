/**
 * Parsers for additional BLE GATT characteristics:
 *  - Cycling Power Measurement (0x2A63)
 *  - CSC Measurement (0x2A5B) — wheel + crank revolutions
 *  - RSC Measurement (0x2A53) — running speed + cadence
 *  - Pulse Oximeter Continuous Measurement (0x2A5F)
 *
 * All parsers accept a `DataView` and return a strongly-typed payload.
 */

// ── Cycling Power (0x2A63) ──────────────────────────────────────────────

/** Parsed Cycling Power Measurement. */
export interface CyclingPowerPacket {
  timestamp: number;
  /** Instantaneous power in watts (signed int16). */
  power: number;
  /** Pedal power balance percentage (left/right) if reported. */
  pedalPowerBalancePct?: number;
  /** Cumulative crank revolutions if reported. */
  crankRevolutions?: number;
  /** Last crank event time in 1/1024 s units, if reported. */
  crankEventTime?: number;
  /** Cumulative wheel revolutions if reported. */
  wheelRevolutions?: number;
  /** Last wheel event time in 1/2048 s units, if reported. */
  wheelEventTime?: number;
}

/** Parse a Cycling Power Measurement (0x2A63) characteristic value. */
export function parseCyclingPower(view: DataView, timestamp: number = Date.now()): CyclingPowerPacket {
  const flags = view.getUint16(0, true);
  let offset = 2;

  const power = view.getInt16(offset, true);
  offset += 2;

  const out: CyclingPowerPacket = { timestamp, power };

  // Bit 0: Pedal Power Balance Present
  if (flags & 0x0001) {
    out.pedalPowerBalancePct = view.getUint8(offset) / 2; // 0.5% units
    offset += 1;
  }
  // Bit 2: Accumulated Torque Present (skip 2 bytes)
  if (flags & 0x0004) {
    offset += 2;
  }
  // Bit 4: Wheel Revolution Data Present (uint32 + uint16)
  if (flags & 0x0010) {
    out.wheelRevolutions = view.getUint32(offset, true);
    out.wheelEventTime = view.getUint16(offset + 4, true);
    offset += 6;
  }
  // Bit 5: Crank Revolution Data Present (uint16 + uint16)
  if (flags & 0x0020) {
    out.crankRevolutions = view.getUint16(offset, true);
    out.crankEventTime = view.getUint16(offset + 2, true);
    offset += 4;
  }
  return out;
}

/**
 * Compute cadence (rpm) from two consecutive crank revolution snapshots.
 * Handles uint16 wraparound on event time.
 */
export function computeCadenceRPM(
  prev: { crankRevolutions: number; crankEventTime: number },
  curr: { crankRevolutions: number; crankEventTime: number },
): number {
  const dRev = (curr.crankRevolutions - prev.crankRevolutions + 0x10000) & 0xffff;
  let dTime = curr.crankEventTime - prev.crankEventTime;
  if (dTime < 0) dTime += 0x10000;
  if (dTime === 0) return 0;
  // event time units: 1/1024 s
  const seconds = dTime / 1024;
  return (dRev / seconds) * 60;
}

// ── CSC Measurement (0x2A5B) ────────────────────────────────────────────

/** Parsed Cycling Speed & Cadence Measurement. */
export interface CSCPacket {
  timestamp: number;
  wheelRevolutions?: number;
  /** 1/1024 s units. */
  wheelEventTime?: number;
  crankRevolutions?: number;
  /** 1/1024 s units. */
  crankEventTime?: number;
}

/** Parse a CSC Measurement (0x2A5B). */
export function parseCSC(view: DataView, timestamp: number = Date.now()): CSCPacket {
  const flags = view.getUint8(0);
  let offset = 1;
  const out: CSCPacket = { timestamp };
  if (flags & 0x01) {
    out.wheelRevolutions = view.getUint32(offset, true);
    out.wheelEventTime = view.getUint16(offset + 4, true);
    offset += 6;
  }
  if (flags & 0x02) {
    out.crankRevolutions = view.getUint16(offset, true);
    out.crankEventTime = view.getUint16(offset + 2, true);
    offset += 4;
  }
  return out;
}

// ── RSC Measurement (0x2A53) ────────────────────────────────────────────

/** Parsed Running Speed & Cadence. */
export interface RSCPacket {
  timestamp: number;
  /** Instantaneous speed in m/s (raw uint16 / 256). */
  speedMps: number;
  /** Instantaneous cadence in steps per minute. */
  cadenceSpm: number;
  /** Stride length in metres, if present. */
  strideLengthM?: number;
  /** Total distance in metres, if present. */
  totalDistanceM?: number;
  /** True if the runner is currently in air (running) vs walking. */
  isRunning?: boolean;
}

/** Parse a RSC Measurement (0x2A53). */
export function parseRSC(view: DataView, timestamp: number = Date.now()): RSCPacket {
  const flags = view.getUint8(0);
  let offset = 1;
  const speedMps = view.getUint16(offset, true) / 256;
  offset += 2;
  const cadenceSpm = view.getUint8(offset);
  offset += 1;
  const out: RSCPacket = { timestamp, speedMps, cadenceSpm };
  if (flags & 0x01) {
    out.strideLengthM = view.getUint16(offset, true) / 100; // cm → m
    offset += 2;
  }
  if (flags & 0x02) {
    out.totalDistanceM = view.getUint32(offset, true) / 10; // 1/10 m units
    offset += 4;
  }
  out.isRunning = (flags & 0x04) !== 0;
  return out;
}

// ── Pulse Oximeter Continuous (0x2A5F) ─────────────────────────────────

/** Parsed continuous pulse-ox reading. */
export interface SpO2Packet {
  timestamp: number;
  /** SpO₂ in percent (sFloat16, 0–100). */
  spo2Pct: number;
  /** Pulse rate in BPM (sFloat16). */
  pulseRateBpm: number;
}

/**
 * Parse a Pulse Oximeter Continuous Measurement (0x2A5F).
 * Spec uses IEEE-11073 sFLOAT16 for SpO₂ and pulse rate.
 */
export function parsePulseOxContinuous(view: DataView, timestamp: number = Date.now()): SpO2Packet {
  // Skip flags byte
  // Bytes 1-2: SpO₂ (sFLOAT16), Bytes 3-4: PR (sFLOAT16)
  const spo2Pct = sFloat16(view.getUint16(1, true));
  const pulseRateBpm = sFloat16(view.getUint16(3, true));
  return { timestamp, spo2Pct, pulseRateBpm };
}

/** Decode IEEE-11073 16-bit SFLOAT (4-bit signed exponent + 12-bit signed mantissa). */
export function sFloat16(raw: number): number {
  // Reserved values per spec
  if (raw === 0x07ff) return Number.NaN;
  if (raw === 0x0800) return Number.NaN;
  if (raw === 0x07fe) return Number.POSITIVE_INFINITY;
  if (raw === 0x0802) return Number.NEGATIVE_INFINITY;

  let exponent = (raw >> 12) & 0x0f;
  if (exponent >= 0x0008) exponent = -(0x000f + 1 - exponent);
  let mantissa = raw & 0x0fff;
  if (mantissa >= 0x0800) mantissa = -(0x0fff + 1 - mantissa);
  return mantissa * 10 ** exponent;
}

// ── Profile presets ─────────────────────────────────────────────────────

import type { DeviceProfile } from './types.js';
import {
  GATT_CSC_SERVICE_UUID,
  GATT_CYCLING_POWER_SERVICE_UUID,
  GATT_PULSE_OX_SERVICE_UUID,
  GATT_RSC_SERVICE_UUID,
} from './types.js';

/** Generic cycling power meter profile. */
export const CYCLING_POWER_PROFILE: DeviceProfile = {
  brand: 'Generic',
  model: 'Cycling Power Meter',
  namePrefix: '',
  capabilities: ['cyclingPower'],
  serviceUUIDs: [GATT_CYCLING_POWER_SERVICE_UUID],
};

/** Generic cycling speed/cadence sensor. */
export const CYCLING_CSC_PROFILE: DeviceProfile = {
  brand: 'Generic',
  model: 'Cycling Speed & Cadence',
  namePrefix: '',
  capabilities: ['cyclingSpeedCadence'],
  serviceUUIDs: [GATT_CSC_SERVICE_UUID],
};

/** Generic running speed/cadence footpod. */
export const RUNNING_RSC_PROFILE: DeviceProfile = {
  brand: 'Generic',
  model: 'Running Footpod',
  namePrefix: '',
  capabilities: ['runningSpeedCadence'],
  serviceUUIDs: [GATT_RSC_SERVICE_UUID],
};

/** Generic continuous pulse oximeter. */
export const PULSE_OX_PROFILE: DeviceProfile = {
  brand: 'Generic',
  model: 'Pulse Oximeter',
  namePrefix: '',
  capabilities: ['spo2'],
  serviceUUIDs: [GATT_PULSE_OX_SERVICE_UUID],
};
