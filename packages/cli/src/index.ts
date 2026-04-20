export { SDK_NAME, SDK_VERSION } from './version.js';

/**
 * Pure helpers for @hrkit/cli — kept separate from process.argv handling so
 * each piece can be unit-tested.
 */

import { parseWorkoutDSL, type WorkoutProtocol, type WorkoutStep } from '@hrkit/core';

export interface HrTimePoint {
  /** Seconds since workout start. */
  t: number;
  /** Heart rate in bpm at time t. */
  hr: number;
}

/**
 * Lower a parsed Workout DSL into a 1 Hz heart-rate profile by interpolating
 * between target HRs across each step. Unknown targets default to easy.
 */
export function workoutToHrProfile(p: WorkoutProtocol, opts: { maxHR?: number } = {}): HrTimePoint[] {
  const max = opts.maxHR ?? 190;
  const targetForStep = (s: WorkoutStep): number => {
    if (s.target?.hrRange) {
      return Math.round((s.target.hrRange[0] + s.target.hrRange[1]) / 2);
    }
    if (s.target?.zone) {
      // mid-points of common 5-zone model in % of maxHR
      const pct: Record<number, number> = { 1: 0.55, 2: 0.65, 3: 0.75, 4: 0.85, 5: 0.95 };
      return Math.round(max * (pct[s.target.zone] ?? 0.6));
    }
    return s.type === 'rest' ? Math.round(max * 0.55) : Math.round(max * 0.65);
  };

  const out: HrTimePoint[] = [];
  let t = 0;
  let lastHr = Math.round(max * 0.55);
  for (const step of p.steps) {
    const target = targetForStep(step);
    for (let i = 0; i < step.durationSec; i++) {
      // simple lerp toward target; converges over ~10s
      lastHr = lastHr + (target - lastHr) * 0.18;
      out.push({ t: t + i, hr: Math.round(lastHr) });
    }
    t += step.durationSec;
  }
  return out;
}

/** Same, but DSL text input (convenience). */
export function dslToHrProfile(dsl: string, opts?: { maxHR?: number }): HrTimePoint[] {
  return workoutToHrProfile(parseWorkoutDSL(dsl), opts);
}

// ── BLE HR Measurement (0x2A37) packet encoder ─────────────────────────

/**
 * Encode an HR measurement packet per BLE GATT 0x2A37 with optional RR.
 * Flags byte: bit0=HR uint16 if set (we use 8-bit), bit4=RR present.
 */
export function encodeHrPacket(hr: number, rr?: number[]): Uint8Array {
  const bounded = Math.max(0, Math.min(255, Math.round(hr)));
  if (!rr || rr.length === 0) {
    return new Uint8Array([0x00, bounded]);
  }
  const buf = new Uint8Array(2 + rr.length * 2);
  buf[0] = 0x10; // RR flag, 8-bit HR
  buf[1] = bounded;
  let i = 2;
  for (const ms of rr) {
    const ticks = Math.max(0, Math.min(0xffff, Math.round((ms * 1024) / 1000)));
    buf[i++] = ticks & 0xff;
    buf[i++] = (ticks >> 8) & 0xff;
  }
  return buf;
}

// ── Conformance fixture creation ────────────────────────────────────────

export interface SubmitFixtureOptions {
  device: string;
  service: string;
  characteristic: string;
  description?: string;
  notifications: Array<{ at_ms: number; bytes_hex: string }>;
}

export function buildConformanceFixture(opts: SubmitFixtureOptions): object {
  return {
    schema_version: 1,
    device: opts.device,
    service: opts.service.toLowerCase(),
    characteristic: opts.characteristic.toLowerCase(),
    description: opts.description ?? '',
    notifications: opts.notifications,
  };
}

// ── CLI argv parsing ─────────────────────────────────────────────────────

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgv(argv: string[]): ParsedArgs {
  if (argv.length === 0) return { command: '', flags: {}, positional: [] };
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i]!;
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq > 0) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[tok.slice(2)] = next;
          i++;
        } else {
          flags[tok.slice(2)] = true;
        }
      }
    } else {
      positional.push(tok);
    }
  }
  return { command: command ?? '', flags, positional };
}
