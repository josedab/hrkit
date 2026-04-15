import type { HRPacket } from './types.js';

const RR_RESOLUTION = 1000 / 1024;

/**
 * Parse a BLE Heart Rate Measurement characteristic (0x2A37).
 * Handles 8/16-bit HR, contact detection, energy expended, and RR intervals.
 */
export function parseHeartRate(data: DataView, timestamp?: number): HRPacket {
  const ts = timestamp ?? Date.now();
  let offset = 0;

  const flags = data.getUint8(offset);
  offset += 1;

  const is16Bit = (flags & 0x01) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = contactSupported ? (flags & 0x02) !== 0 : true;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

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
