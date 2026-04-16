import { describe, it, expect } from 'vitest';
import { sessionToJSON, sessionFromJSON, sessionToCSV, roundsToCSV } from '../session-serialization.js';
import { ParseError } from '../errors.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';
import type { Session } from '../types.js';

function makeSession(overrides?: Partial<Session>): Session {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime: 1000,
    endTime: 5000,
    samples: [
      { timestamp: 1000, hr: 72 },
      { timestamp: 2000, hr: 85 },
      { timestamp: 3000, hr: 120 },
      { timestamp: 4000, hr: 150 },
      { timestamp: 5000, hr: 130 },
    ],
    rrIntervals: [833, 706, 500, 400, 462],
    rounds: [
      {
        index: 0,
        startTime: 2000,
        endTime: 4000,
        samples: [
          { timestamp: 2000, hr: 85 },
          { timestamp: 3000, hr: 120 },
          { timestamp: 4000, hr: 150 },
        ],
        rrIntervals: [706, 500, 400],
        meta: { label: 'Round 1' },
      },
    ],
    config: { maxHR: 185, restHR: 48 },
    ...overrides,
  };
}

describe('sessionToJSON', () => {
  it('serializes a session to valid JSON', () => {
    const session = makeSession();
    const json = sessionToJSON(session);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(parsed.samples).toHaveLength(5);
  });

  it('preserves all fields in round-trip', () => {
    const session = makeSession({
      metadata: { activity: 'bjj' },
      deviceInfo: { id: 'dev-1', name: 'Test Device' },
    });

    const json = sessionToJSON(session);
    const restored = sessionFromJSON(json);

    expect(restored.schemaVersion).toBe(session.schemaVersion);
    expect(restored.startTime).toBe(session.startTime);
    expect(restored.endTime).toBe(session.endTime);
    expect(restored.samples).toEqual(session.samples);
    expect(restored.rrIntervals).toEqual(session.rrIntervals);
    expect(restored.rounds).toEqual(session.rounds);
    expect(restored.config).toEqual(session.config);
    expect(restored.metadata).toEqual(session.metadata);
    expect(restored.deviceInfo).toEqual(session.deviceInfo);
  });
});

describe('sessionFromJSON', () => {
  it('parses valid JSON', () => {
    const session = makeSession();
    const json = sessionToJSON(session);
    const restored = sessionFromJSON(json);

    expect(restored.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(restored.samples).toHaveLength(5);
  });

  it('throws ParseError on invalid JSON string', () => {
    expect(() => sessionFromJSON('not json')).toThrow(ParseError);
    expect(() => sessionFromJSON('not json')).toThrow('Invalid JSON');
  });

  it('throws ParseError on non-object JSON', () => {
    expect(() => sessionFromJSON('"just a string"')).toThrow(ParseError);
    expect(() => sessionFromJSON('42')).toThrow(ParseError);
    expect(() => sessionFromJSON('null')).toThrow(ParseError);
  });

  it('throws ParseError on missing schemaVersion', () => {
    const json = JSON.stringify({ startTime: 0, endTime: 1 });
    expect(() => sessionFromJSON(json)).toThrow(ParseError);
    expect(() => sessionFromJSON(json)).toThrow('schemaVersion');
  });

  it('throws ParseError on future schema version', () => {
    const json = JSON.stringify({
      schemaVersion: 999,
      startTime: 0,
      endTime: 1,
      samples: [],
      rrIntervals: [],
      rounds: [],
      config: { maxHR: 185 },
    });
    expect(() => sessionFromJSON(json)).toThrow(ParseError);
    expect(() => sessionFromJSON(json)).toThrow('Unsupported schema version');
    expect(() => sessionFromJSON(json)).toThrow('upgrade');
  });

  it('throws ParseError on missing required fields', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      startTime: 0,
      // missing endTime, samples, etc.
    });
    expect(() => sessionFromJSON(json)).toThrow(ParseError);
    expect(() => sessionFromJSON(json)).toThrow('Missing required field');
  });

  it('throws ParseError when samples is not an array', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      startTime: 0,
      endTime: 1,
      samples: 'not an array',
      rrIntervals: [],
      rounds: [],
      config: { maxHR: 185 },
    });
    expect(() => sessionFromJSON(json)).toThrow(ParseError);
    expect(() => sessionFromJSON(json)).toThrow('samples must be an array');
  });

  it('throws ParseError when rrIntervals is not an array', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      startTime: 0,
      endTime: 1,
      samples: [],
      rrIntervals: 'bad',
      rounds: [],
      config: { maxHR: 185 },
    });
    expect(() => sessionFromJSON(json)).toThrow('rrIntervals must be an array');
  });

  it('throws ParseError when rounds is not an array', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      startTime: 0,
      endTime: 1,
      samples: [],
      rrIntervals: [],
      rounds: 'bad',
      config: { maxHR: 185 },
    });
    expect(() => sessionFromJSON(json)).toThrow('rounds must be an array');
  });

  it('accepts current schema version', () => {
    const session = makeSession();
    const json = sessionToJSON(session);
    expect(() => sessionFromJSON(json)).not.toThrow();
  });
});

describe('sessionToCSV', () => {
  it('exports basic CSV with timestamp and HR', () => {
    const session = makeSession();
    const csv = sessionToCSV(session);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('timestamp,hr');
    expect(lines).toHaveLength(6); // header + 5 samples
    expect(lines[1]).toBe('1000,72');
    expect(lines[5]).toBe('5000,130');
  });

  it('exports CSV with RR intervals when requested', () => {
    const session = makeSession();
    const csv = sessionToCSV(session, { includeRR: true });
    const lines = csv.split('\n');

    expect(lines[0]).toBe('timestamp,hr,rrIntervals');
    expect(lines[1]).toContain('833');
  });

  it('handles empty session', () => {
    const session = makeSession({
      samples: [],
      rrIntervals: [],
      rounds: [],
    });
    const csv = sessionToCSV(session);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1); // header only
    expect(lines[0]).toBe('timestamp,hr');
  });
});

describe('roundsToCSV', () => {
  it('exports round data as CSV', () => {
    const session = makeSession();
    const csv = roundsToCSV(session);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('index,startTime,endTime,durationSec,sampleCount,rrCount,label');
    expect(lines).toHaveLength(2); // header + 1 round
    expect(lines[1]).toContain('Round 1');
    expect(lines[1]).toContain(',3,'); // 3 samples
  });

  it('handles session with no rounds', () => {
    const session = makeSession({ rounds: [] });
    const csv = roundsToCSV(session);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1); // header only
  });

  it('handles rounds without metadata', () => {
    const session = makeSession({
      rounds: [{
        index: 0,
        startTime: 1000,
        endTime: 3000,
        samples: [{ timestamp: 1000, hr: 120 }],
        rrIntervals: [],
      }],
    });
    const csv = roundsToCSV(session);
    const lines = csv.split('\n');

    expect(lines[1]).toContain('""'); // empty label
  });
});
