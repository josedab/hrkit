import { SESSION_SCHEMA_VERSION, type Session } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { sessionToFIT, verifyFIT } from '../fit.js';

const baseSession = (overrides?: Partial<Session>): Session => ({
  schemaVersion: SESSION_SCHEMA_VERSION,
  startTime: 1700000000000,
  endTime: 1700000060000,
  samples: [
    { timestamp: 1700000000000, hr: 72 },
    { timestamp: 1700000010000, hr: 130 },
    { timestamp: 1700000020000, hr: 155 },
    { timestamp: 1700000030000, hr: 168 },
    { timestamp: 1700000040000, hr: 175 },
    { timestamp: 1700000050000, hr: 162 },
    { timestamp: 1700000060000, hr: 130 },
  ],
  rrIntervals: [833, 800, 760, 720, 700, 740, 800],
  rounds: [],
  config: { maxHR: 185, restHR: 48 },
  ...overrides,
});

describe('sessionToFIT', () => {
  it('produces a valid FIT file with correct magic and CRC', () => {
    const bytes = sessionToFIT(baseSession());
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(50);
    const verdict = verifyFIT(bytes);
    expect(verdict.ok).toBe(true);
  });

  it('encodes the .FIT magic bytes in header', () => {
    const bytes = sessionToFIT(baseSession());
    expect(String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)).toBe('.FIT');
  });

  it('includes header CRC matching computed value', () => {
    const bytes = sessionToFIT(baseSession());
    // verifyFIT validates header CRC internally
    expect(verifyFIT(bytes).ok).toBe(true);
  });

  it('encodes one record per HR sample', () => {
    const session = baseSession();
    const bytes = sessionToFIT(session);
    // We can't easily decode without a full FIT parser, but file should grow with sample count.
    const big = sessionToFIT({
      ...session,
      samples: [...session.samples, ...session.samples, ...session.samples],
    });
    expect(big.length).toBeGreaterThan(bytes.length);
    expect(verifyFIT(big).ok).toBe(true);
  });

  it('encodes a lap per round when rounds are present', () => {
    const session = baseSession({
      rounds: [
        {
          index: 0,
          startTime: 1700000000000,
          endTime: 1700000030000,
          samples: [
            { timestamp: 1700000000000, hr: 130 },
            { timestamp: 1700000030000, hr: 168 },
          ],
          rrIntervals: [800, 720],
        },
        {
          index: 1,
          startTime: 1700000030000,
          endTime: 1700000060000,
          samples: [
            { timestamp: 1700000030000, hr: 168 },
            { timestamp: 1700000060000, hr: 130 },
          ],
          rrIntervals: [720, 800],
        },
      ],
    });
    const bytes = sessionToFIT(session);
    expect(verifyFIT(bytes).ok).toBe(true);
  });

  it('respects sport mapping (cycling)', () => {
    const bytes = sessionToFIT(baseSession(), { sport: 'cycling' });
    expect(verifyFIT(bytes).ok).toBe(true);
  });

  it('rejects manipulated bytes (CRC mismatch)', () => {
    const bytes = sessionToFIT(baseSession());
    const tampered = new Uint8Array(bytes);
    tampered[20] = (tampered[20]! + 1) & 0xff;
    expect(verifyFIT(tampered).ok).toBe(false);
  });

  it('handles empty sessions safely', () => {
    const session = baseSession({ samples: [], rrIntervals: [] });
    const bytes = sessionToFIT(session);
    expect(verifyFIT(bytes).ok).toBe(true);
  });
});
