import type { HRConnection } from '@hrkit/core';

// ── ECG ─────────────────────────────────────────────────────────────────

export interface ECGPacket {
  timestamp: number;
  samples: number[];
  sampleRate: 130;
}

// ── Accelerometer ───────────────────────────────────────────────────────

export interface ACCSample {
  x: number;
  y: number;
  z: number;
}

export interface ACCPacket {
  timestamp: number;
  samples: ACCSample[];
  sampleRate: 25 | 50 | 100 | 200;
}

// ── Polar Connection ────────────────────────────────────────────────────

export interface PolarConnection extends HRConnection {
  ecg(): AsyncIterable<ECGPacket>;
  accelerometer(): AsyncIterable<ACCPacket>;
  requestMTU(mtu: number): Promise<number>;
}
