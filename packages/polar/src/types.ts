import type { HRConnection } from '@hrkit/core';

// ── ECG ─────────────────────────────────────────────────────────────────

/** ECG data packet from a Polar PMD stream (130Hz, 14-bit resolution). */
export interface ECGPacket {
  /** Timestamp in microseconds from the device's internal clock. */
  timestamp: number;
  /** ECG sample values (signed integers representing microvolts). */
  samples: number[];
  /** Fixed sample rate for Polar ECG streaming. */
  sampleRate: 130;
}

// ── Accelerometer ───────────────────────────────────────────────────────

/** A single 3-axis accelerometer sample in milligravity (mG). */
export interface ACCSample {
  x: number;
  y: number;
  z: number;
}

/** Accelerometer data packet from a Polar PMD stream. */
export interface ACCPacket {
  /** Timestamp in microseconds from the device's internal clock. */
  timestamp: number;
  samples: ACCSample[];
  sampleRate: 25 | 50 | 100 | 200;
}

// ── Polar Connection ────────────────────────────────────────────────────

/**
 * Extended connection interface for Polar devices with PMD support.
 * Adds ECG streaming, accelerometer streaming, and MTU negotiation.
 */
export interface PolarConnection extends HRConnection {
  /** Stream raw ECG data at 130Hz. Available on H10 and H9. */
  ecg(): AsyncIterable<ECGPacket>;
  /** Stream accelerometer data. Available on H10, OH1, and Verity Sense. */
  accelerometer(): AsyncIterable<ACCPacket>;
  /** Request a specific BLE MTU size. Returns the negotiated MTU. */
  requestMTU(mtu: number): Promise<number>;
}
