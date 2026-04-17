/**
 * Multi-modal sensor fusion utilities.
 *
 * Beyond heart rate, modern athletes also wear cycling power meters,
 * smart trainers (FE-C / FTMS), and continuous glucose monitors (CGM).
 * This module provides:
 *
 *   - FE-C / FTMS control message *encoders* — pure functions that emit the
 *     bytes a smart trainer expects on its control characteristic. We do
 *     not transmit them; the platform adapter does. Encoding here means we
 *     can unit-test the protocol without hardware.
 *   - A {@link GlucoseSource} interface so abstract CGM bridges (Dexcom
 *     Share, Libre Link, BLE GATT 0x1808) can plug into a session recorder.
 *   - {@link FusedSample} — a unified record combining HR + power + speed +
 *     cadence + glucose at a common timestamp.
 */

// ── FTMS / FE-C control message encoding ────────────────────────────────

/**
 * FTMS Fitness Machine Control Point opcodes (BLE GATT 0x2AD9). FE-C over
 * BLE uses a slightly different framing layered over GATT, but the opcode
 * numbers map 1:1 for the common operations.
 */
export const FTMS_OPCODE = {
  REQUEST_CONTROL: 0x00,
  RESET: 0x01,
  SET_TARGET_POWER: 0x05,
  SET_TARGET_RESISTANCE: 0x04,
  SET_INDOOR_BIKE_SIMULATION: 0x11,
  START_OR_RESUME: 0x07,
  STOP_OR_PAUSE: 0x08,
} as const;

export function encodeRequestControl(): Uint8Array {
  return new Uint8Array([FTMS_OPCODE.REQUEST_CONTROL]);
}

export function encodeReset(): Uint8Array {
  return new Uint8Array([FTMS_OPCODE.RESET]);
}

/** Set a target power in watts. Spec: signed 16-bit little-endian. */
export function encodeSetTargetPower(watts: number): Uint8Array {
  const w = Math.max(-32768, Math.min(32767, Math.round(watts)));
  const buf = new Uint8Array(3);
  buf[0] = FTMS_OPCODE.SET_TARGET_POWER;
  buf[1] = w & 0xff;
  buf[2] = (w >> 8) & 0xff;
  return buf;
}

/**
 * Set indoor-bike simulation parameters (wind, grade, rolling/wind drag).
 * The full spec packs each value as a signed 16-bit little-endian integer
 * with vendor-specific scaling — we match the Wahoo Kickr / Tacx convention
 * used by Zwift: grade in 0.01% units, drag/rolling in 0.0001/0.01 units.
 */
export function encodeSetIndoorBikeSimulation(opts: {
  /** m/s, signed. */
  windSpeed?: number;
  /** percent, e.g. 4.5 = 4.5% climb. */
  gradePercent?: number;
  /** Coefficient of rolling resistance (typ. 0.004). */
  rollingResistance?: number;
  /** Wind resistance coefficient kg/m (typ. 0.51). */
  windResistance?: number;
}): Uint8Array {
  const buf = new Uint8Array(7);
  buf[0] = FTMS_OPCODE.SET_INDOOR_BIKE_SIMULATION;
  const wind = Math.round((opts.windSpeed ?? 0) * 1000);
  const grade = Math.round((opts.gradePercent ?? 0) * 100);
  const cr = Math.round((opts.rollingResistance ?? 0.004) * 10000);
  const cw = Math.round((opts.windResistance ?? 0.51) * 100);
  buf[1] = wind & 0xff;
  buf[2] = (wind >> 8) & 0xff;
  buf[3] = grade & 0xff;
  buf[4] = (grade >> 8) & 0xff;
  buf[5] = cr & 0xff;
  buf[6] = cw & 0xff;
  return buf;
}

// ── Continuous glucose monitor bridge ───────────────────────────────────

export interface GlucoseReading {
  /** mg/dL. */
  mgdl: number;
  /** ms since epoch. */
  timestamp: number;
  /** Trend arrow if reported (-2 falling fast, 0 flat, +2 rising fast). */
  trend?: -2 | -1 | 0 | 1 | 2;
}

/**
 * Abstract source of glucose readings. Implementations can wrap:
 *   - BLE GATT Glucose Profile (0x1808 / 0x2A18) for medical-grade meters
 *   - Vendor cloud APIs (Dexcom Share, Libre LinkUp)
 *   - File replay (test fixtures)
 */
export interface GlucoseSource {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Push-style subscription. */
  subscribe(handler: (r: GlucoseReading) => void): () => void;
}

/** In-memory replay source for tests. */
export class MemoryGlucoseSource implements GlucoseSource {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Array<(r: GlucoseReading) => void> = [];
  constructor(private readonly readings: GlucoseReading[]) {}

  async start(): Promise<void> {
    let i = 0;
    const tick = () => {
      const r = this.readings[i++];
      if (!r) {
        if (this.timer) clearTimeout(this.timer);
        return;
      }
      for (const h of this.handlers) h(r);
      this.timer = setTimeout(tick, 1);
    };
    tick();
  }
  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  subscribe(handler: (r: GlucoseReading) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}

// ── Fused sample shape ──────────────────────────────────────────────────

export interface FusedSample {
  timestamp: number;
  hr?: number;
  rrIntervals?: number[];
  powerWatts?: number;
  cadenceRpm?: number;
  speedKph?: number;
  glucoseMgdl?: number;
}

/**
 * Time-align an array of per-modality streams into {@link FusedSample}s. Uses
 * forward-fill within `windowMs` so an HR sample at t and a power sample at
 * t+200ms become a single fused sample at t+200ms with the most recent HR.
 */
export function fuseStreams(
  streams: {
    hr?: Array<{ timestamp: number; hr: number; rrIntervals?: number[] }>;
    power?: Array<{ timestamp: number; powerWatts: number; cadenceRpm?: number }>;
    speed?: Array<{ timestamp: number; speedKph: number }>;
    glucose?: GlucoseReading[];
  },
  windowMs = 5_000,
): FusedSample[] {
  type AnyEvt = { ts: number; kind: string; data: Record<string, unknown> };
  const events: AnyEvt[] = [];
  for (const s of streams.hr ?? [])
    events.push({ ts: s.timestamp, kind: 'hr', data: { hr: s.hr, rrIntervals: s.rrIntervals } });
  for (const s of streams.power ?? [])
    events.push({ ts: s.timestamp, kind: 'power', data: { powerWatts: s.powerWatts, cadenceRpm: s.cadenceRpm } });
  for (const s of streams.speed ?? []) events.push({ ts: s.timestamp, kind: 'speed', data: { speedKph: s.speedKph } });
  for (const r of streams.glucose ?? [])
    events.push({ ts: r.timestamp, kind: 'glucose', data: { glucoseMgdl: r.mgdl } });
  events.sort((a, b) => a.ts - b.ts);

  const carry: Record<string, { ts: number; data: Record<string, unknown> }> = {};
  const out: FusedSample[] = [];
  for (const e of events) {
    carry[e.kind] = { ts: e.ts, data: e.data };
    const sample: FusedSample = { timestamp: e.ts };
    for (const [kind, c] of Object.entries(carry)) {
      if (e.ts - c.ts <= windowMs) {
        Object.assign(sample, c.data);
      } else {
        delete carry[kind];
      }
    }
    out.push(sample);
  }
  return out;
}
