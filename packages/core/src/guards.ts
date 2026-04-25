import type { HRDevice, HRPacket, Session } from './types.js';

/**
 * Runtime type guard for {@link HRPacket}.
 *
 * Validates structural shape — useful for checking data received from
 * external sources (e.g., JSON deserialization, WebSocket messages).
 *
 * @param value - Value to check.
 * @returns `true` if the value satisfies the {@link HRPacket} interface.
 *
 * @example
 * ```ts
 * const data: unknown = JSON.parse(raw);
 * if (isHRPacket(data)) {
 *   console.log(data.hr); // typed as HRPacket
 * }
 * ```
 */
export function isHRPacket(value: unknown): value is HRPacket {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.timestamp === 'number' &&
    typeof obj.hr === 'number' &&
    Array.isArray(obj.rrIntervals) &&
    typeof obj.contactDetected === 'boolean'
  );
}

/**
 * Runtime type guard for {@link HRDevice}.
 *
 * @param value - Value to check.
 * @returns `true` if the value satisfies the {@link HRDevice} interface.
 */
export function isHRDevice(value: unknown): value is HRDevice {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.name === 'string' && typeof obj.rssi === 'number';
}

/**
 * Runtime type guard for {@link Session}.
 *
 * Validates the structural shape including required nested arrays.
 *
 * @param value - Value to check.
 * @returns `true` if the value satisfies the {@link Session} interface.
 */
export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.schemaVersion === 'number' &&
    typeof obj.startTime === 'number' &&
    typeof obj.endTime === 'number' &&
    Array.isArray(obj.samples) &&
    Array.isArray(obj.rrIntervals) &&
    Array.isArray(obj.rounds) &&
    typeof obj.config === 'object' &&
    obj.config !== null
  );
}
