import { ParseError } from './errors.js';
import type { HRPacket } from './types.js';

const RR_RESOLUTION = 1000 / 1024;

/**
 * Parse a BLE Heart Rate Measurement characteristic (0x2A37).
 * Handles 8/16-bit HR, contact detection, energy expended, and RR intervals.
 *
 * @param data - Raw DataView from a GATT notification (Heart Rate Measurement characteristic).
 * @param timestamp - Optional packet timestamp in ms. Defaults to `Date.now()`.
 * @returns Parsed {@link HRPacket} with HR, RR intervals, contact, and energy fields.
 * @throws {ParseError} if the DataView is too short to contain valid HR data.
 *
 * @example
 * ```typescript
 * const data = new DataView(event.target.value.buffer);
 * const packet = parseHeartRate(data, Date.now());
 * console.log(packet.hr, packet.rrIntervals);
 * ```
 */
export function parseHeartRate(data: DataView, timestamp?: number): HRPacket {
  if (data.byteLength < 2) {
    throw new ParseError(`Heart Rate Measurement too short: expected at least 2 bytes, got ${data.byteLength}`);
  }

  const ts = timestamp ?? Date.now();
  let offset = 0;

  const flags = data.getUint8(offset);
  offset += 1;

  const is16Bit = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = contactSupported ? (flags & 0x02) !== 0 : true;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  const hrBytes = is16Bit ? 2 : 1;
  if (offset + hrBytes > data.byteLength) {
    throw new ParseError(
      `Heart Rate Measurement truncated: need ${offset + hrBytes} bytes for HR value, got ${data.byteLength}`,
    );
  }

  let hr: number;
  if (is16Bit) {
    hr = data.getUint16(offset, true);
    offset += 2;
  } else {
    hr = data.getUint8(offset);
    offset += 1;
  }

  let energyExpended: number | undefined;
  if (hasEnergy) {
    if (offset + 2 > data.byteLength) {
      throw new ParseError(
        `Heart Rate Measurement truncated: need ${offset + 2} bytes for energy field, got ${data.byteLength}`,
      );
    }
    energyExpended = data.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if (hasRR) {
    while (offset + 1 < data.byteLength) {
      const rawRR = data.getUint16(offset, true);
      rrIntervals.push(rawRR * RR_RESOLUTION);
      offset += 2;
    }
  }

  return { timestamp: ts, hr, rrIntervals, contactDetected, energyExpended };
}
