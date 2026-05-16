import type { HRPacket } from '@hrkit/core';

// ── Public types ────────────────────────────────────────────────────────

/** Data broadcast to clients on each HR packet. */
export interface BroadcastPayload {
  /** Timestamp of the HR packet. */
  timestamp: number;
  /** Heart rate in BPM. */
  hr: number;
  /** RR intervals in ms. */
  rrIntervals: number[];
  /** Current HR zone (1-5), if zone config provided. */
  zone?: number;
  /** Cumulative TRIMP, if config provided. */
  trimp?: number;
  /** Rolling rMSSD, if available. */
  rmssd?: number;
  /** Custom data from user. */
  custom?: Record<string, unknown>;
}

/** Extra metrics to include alongside an HRPacket broadcast. */
export interface BroadcastExtra {
  zone?: number;
  trimp?: number;
  rmssd?: number;
  custom?: Record<string, unknown>;
}

/** Build a BroadcastPayload from an HRPacket and optional extras. */
export function buildPayload(packet: HRPacket, extra?: BroadcastExtra): BroadcastPayload {
  const payload: BroadcastPayload = {
    timestamp: packet.timestamp,
    hr: packet.hr,
    rrIntervals: packet.rrIntervals,
  };
  if (extra?.zone !== undefined) payload.zone = extra.zone;
  if (extra?.trimp !== undefined) payload.trimp = extra.trimp;
  if (extra?.rmssd !== undefined) payload.rmssd = extra.rmssd;
  if (extra?.custom !== undefined) payload.custom = extra.custom;
  return payload;
}
