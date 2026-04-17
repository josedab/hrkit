/**
 * Hardware conformance test rig.
 *
 * Defines a portable JSON fixture format that captures a recording from a
 * real BLE device, plus a replay validator that asserts a given parser /
 * profile produces the expected output. Use this to:
 *
 *   - Lock down support for a new device (capture once, regress forever).
 *   - Compare devices against the GATT spec (RR conversion, contact bit, etc.).
 *   - Catch firmware regressions.
 *
 * Fixtures are pure JSON so they can be checked into a public corpus.
 */

import { parseHeartRate } from './gatt-parser.js';
import type { HRPacket } from './types.js';

/** Schema version of the conformance fixture format. Increment on breaking changes. */
export const CONFORMANCE_FIXTURE_SCHEMA = 1;

/** A single recorded BLE GATT notification (raw bytes + timestamp). */
export interface RecordedNotification {
  /** Notification timestamp, ms since epoch (or test-relative). */
  timestamp: number;
  /** Hex-encoded raw bytes from the GATT notification. */
  hex: string;
}

/** A conformance fixture captured from a physical device. */
export interface ConformanceFixture {
  schemaVersion: number;
  device: {
    brand: string;
    model: string;
    firmware?: string;
    /** BLE service UUID this fixture covers. */
    serviceUuid: string;
    /** Characteristic UUID. */
    characteristicUuid: string;
  };
  /** Optional human notes about how the recording was taken. */
  notes?: string;
  /** Recorded raw notifications. */
  notifications: RecordedNotification[];
  /**
   * Optional expected output. If present, `verifyFixture` will compare against it.
   * Each entry corresponds 1-to-1 with `notifications`.
   */
  expected?: Partial<HRPacket>[];
}

/** Result of validating a fixture. */
export interface ConformanceResult {
  /** True if all expectations passed (or no expectations provided). */
  ok: boolean;
  /** Number of notifications processed. */
  total: number;
  /** Number of notifications that produced a packet matching expectations. */
  passed: number;
  /** Per-notification failure details. */
  failures: { index: number; expected: Partial<HRPacket>; actual: HRPacket; reason: string }[];
}

/** Convert a hex string (with or without spaces) into a DataView. */
export function hexToDataView(hex: string): DataView {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('hex string has odd length');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex at offset ${i * 2}`);
    bytes[i] = byte;
  }
  return new DataView(bytes.buffer);
}

/** Convert a Uint8Array or DataView into a lowercase hex string. */
export function bytesToHex(input: Uint8Array | DataView): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0');
  }
  return s;
}

/**
 * Replay a fixture against the standard `parseHeartRate` parser and verify
 * that each notification produces a packet that matches the expected output.
 *
 * Only fields present in `expected[i]` are compared — undefined fields are
 * ignored so fixtures can opt out of strict checking on optional fields.
 */
export function verifyFixture(fixture: ConformanceFixture): ConformanceResult {
  const failures: ConformanceResult['failures'] = [];
  let passed = 0;

  for (let i = 0; i < fixture.notifications.length; i++) {
    const note = fixture.notifications[i]!;
    let view: DataView;
    try {
      view = hexToDataView(note.hex);
    } catch (e) {
      failures.push({
        index: i,
        expected: fixture.expected?.[i] ?? {},
        actual: { timestamp: note.timestamp, hr: 0, rrIntervals: [], contactDetected: false },
        reason: `hex decode failed: ${(e as Error).message}`,
      });
      continue;
    }

    const actual = parseHeartRate(view, note.timestamp);
    const expected = fixture.expected?.[i];
    if (!expected) {
      passed++;
      continue;
    }
    const reason = compareHRPacket(expected, actual);
    if (reason === null) {
      passed++;
    } else {
      failures.push({ index: i, expected, actual, reason });
    }
  }

  return { ok: failures.length === 0, total: fixture.notifications.length, passed, failures };
}

function compareHRPacket(expected: Partial<HRPacket>, actual: HRPacket): string | null {
  if (expected.hr !== undefined && expected.hr !== actual.hr) {
    return `hr mismatch: expected ${expected.hr}, got ${actual.hr}`;
  }
  if (expected.contactDetected !== undefined && expected.contactDetected !== actual.contactDetected) {
    return `contactDetected mismatch: expected ${expected.contactDetected}, got ${actual.contactDetected}`;
  }
  if (expected.energyExpended !== undefined && expected.energyExpended !== actual.energyExpended) {
    return `energyExpended mismatch: expected ${expected.energyExpended}, got ${actual.energyExpended}`;
  }
  if (expected.rrIntervals !== undefined) {
    const a = expected.rrIntervals;
    const b = actual.rrIntervals;
    if (a.length !== b.length) return `rrIntervals length mismatch: expected ${a.length}, got ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      // RR intervals are computed via *1000/1024 → tolerate ±1 ms rounding.
      if (Math.abs(a[i]! - b[i]!) > 1) {
        return `rrIntervals[${i}] mismatch: expected ${a[i]}, got ${b[i]}`;
      }
    }
  }
  return null;
}

/**
 * Helper to record a single notification at capture time. Useful when
 * authoring fixtures from real device data.
 */
export function recordNotification(view: DataView | Uint8Array, timestamp: number = Date.now()): RecordedNotification {
  return { timestamp, hex: bytesToHex(view) };
}
