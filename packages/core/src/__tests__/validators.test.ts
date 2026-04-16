import { describe, expect, it } from 'vitest';
import type { HRPacket, HRZoneConfig, Session, SessionConfig } from '../types.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';
import { validateHRPacket, validateSession, validateSessionConfig, validateZoneConfig } from '../validators.js';

function pkt(overrides: Partial<HRPacket> = {}): HRPacket {
  return { timestamp: 1000, hr: 72, rrIntervals: [833], contactDetected: true, ...overrides };
}

describe('validateHRPacket', () => {
  it('passes valid packet with defaults', () => {
    const result = validateHRPacket(pkt());
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('warns on HR below range', () => {
    const result = validateHRPacket(pkt({ hr: 20 }));
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('HR 20');
  });

  it('warns on HR above range', () => {
    const result = validateHRPacket(pkt({ hr: 300 }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('HR 300');
  });

  it('warns on RR below range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [100] }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('RR');
    expect(result.warnings[0]).toContain('100');
  });

  it('warns on RR above range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [2500] }));
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain('RR');
  });

  it('accumulates multiple warnings', () => {
    const result = validateHRPacket(pkt({ hr: 10, rrIntervals: [50, 3000] }));
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(3); // HR + 2 RR
  });

  it('accepts custom HR range', () => {
    const result = validateHRPacket(pkt({ hr: 20 }), { hrRange: [10, 50] });
    expect(result.valid).toBe(true);
  });

  it('accepts custom RR range', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [100] }), { rrRange: [50, 150] });
    expect(result.valid).toBe(true);
  });

  it('passes with empty RR intervals', () => {
    const result = validateHRPacket(pkt({ rrIntervals: [] }));
    expect(result.valid).toBe(true);
  });

  it('boundary: HR at exact range limits passes', () => {
    expect(validateHRPacket(pkt({ hr: 30 })).valid).toBe(true);
    expect(validateHRPacket(pkt({ hr: 250 })).valid).toBe(true);
  });

  it('boundary: RR at exact range limits passes', () => {
    expect(validateHRPacket(pkt({ rrIntervals: [200] })).valid).toBe(true);
    expect(validateHRPacket(pkt({ rrIntervals: [2000] })).valid).toBe(true);
  });

  it('returns empty errors array', () => {
    const result = validateHRPacket(pkt());
    expect(result.errors).toEqual([]);
  });
});

describe('validateZoneConfig', () => {
  function zoneConfig(overrides?: Partial<HRZoneConfig>): HRZoneConfig {
    return { maxHR: 185, restHR: 48, zones: [0.6, 0.7, 0.8, 0.9], ...overrides };
  }

  it('passes valid zone config', () => {
    const result = validateZoneConfig(zoneConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('errors on non-positive maxHR', () => {
    const result = validateZoneConfig(zoneConfig({ maxHR: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxHR must be positive');
  });

  it('errors on negative restHR', () => {
    const result = validateZoneConfig(zoneConfig({ restHR: -5 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('restHR must be non-negative');
  });

  it('errors on restHR >= maxHR', () => {
    const result = validateZoneConfig(zoneConfig({ restHR: 200, maxHR: 185 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('restHR must be less than maxHR');
  });

  it('errors on zone threshold out of [0,1] range', () => {
    const result = validateZoneConfig(zoneConfig({ zones: [-0.1, 0.7, 0.8, 0.9] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Zone threshold 0'))).toBe(true);
  });

  it('errors on non-ascending zone thresholds', () => {
    const result = validateZoneConfig(zoneConfig({ zones: [0.8, 0.7, 0.6, 0.5] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Zone thresholds must be in strictly ascending order');
  });

  it('errors on equal adjacent zone thresholds', () => {
    const result = validateZoneConfig(zoneConfig({ zones: [0.6, 0.6, 0.8, 0.9] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Zone thresholds must be in strictly ascending order');
  });

  it('passes without restHR', () => {
    const result = validateZoneConfig({ maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] });
    expect(result.valid).toBe(true);
  });
});

describe('validateSessionConfig', () => {
  it('passes valid session config', () => {
    const result = validateSessionConfig({ maxHR: 185, restHR: 48 });
    expect(result.valid).toBe(true);
  });

  it('errors on non-positive maxHR', () => {
    const result = validateSessionConfig({ maxHR: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxHR must be positive');
  });

  it('errors on negative restHR', () => {
    const result = validateSessionConfig({ maxHR: 185, restHR: -10 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('restHR must be non-negative');
  });

  it('validates embedded zones', () => {
    const config: SessionConfig = { maxHR: 185, zones: [0.9, 0.7, 0.8, 0.6] };
    const result = validateSessionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Zone thresholds must be in strictly ascending order');
  });

  it('passes config with valid zones', () => {
    const config: SessionConfig = { maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] };
    const result = validateSessionConfig(config);
    expect(result.valid).toBe(true);
  });
});

describe('validateSession', () => {
  function makeSession(overrides?: Partial<Session>): Session {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startTime: 1000,
      endTime: 5000,
      samples: [
        { timestamp: 1000, hr: 72 },
        { timestamp: 2000, hr: 85 },
        { timestamp: 3000, hr: 120 },
      ],
      rrIntervals: [833, 706, 500],
      rounds: [],
      config: { maxHR: 185, restHR: 48 },
      ...overrides,
    };
  }

  it('passes valid session', () => {
    const result = validateSession(makeSession());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('errors when endTime < startTime', () => {
    const result = validateSession(makeSession({ startTime: 5000, endTime: 1000 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('endTime must be >= startTime');
  });

  it('warns on empty samples', () => {
    const result = validateSession(makeSession({ samples: [] }));
    expect(result.warnings).toContain('Session has no samples');
  });

  it('errors on out-of-order sample timestamps', () => {
    const result = validateSession(
      makeSession({
        samples: [
          { timestamp: 2000, hr: 85 },
          { timestamp: 1000, hr: 72 },
          { timestamp: 3000, hr: 120 },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Sample 1 has timestamp before sample 0'))).toBe(true);
  });

  it('errors on round with endTime before startTime', () => {
    const result = validateSession(
      makeSession({
        rounds: [
          {
            index: 0,
            startTime: 3000,
            endTime: 1000,
            samples: [],
            rrIntervals: [],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Round 0'))).toBe(true);
  });

  it('propagates config validation errors', () => {
    const result = validateSession(makeSession({ config: { maxHR: -5 } }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxHR must be positive');
  });
});
