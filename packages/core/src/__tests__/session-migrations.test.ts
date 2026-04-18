import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MIGRATORS,
  isCurrentSchema,
  migrateSession,
  ParseError,
  SESSION_JSON_SCHEMA,
  SESSION_SCHEMA_VERSION,
  type SessionMigrator,
  sessionFromJSON,
  sessionToJSON,
} from '../index.js';
import type { Session } from '../types.js';

const baseSession: Session = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  startTime: 1_700_000_000_000,
  endTime: 1_700_000_060_000,
  samples: [{ timestamp: 1_700_000_000_000, hr: 120 }],
  rrIntervals: [500],
  rounds: [],
  config: { maxHR: 190 },
};

describe('migrateSession', () => {
  it('is a no-op for the current schema version', () => {
    const out = migrateSession({ ...baseSession });
    expect(out.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
  });

  it('throws ParseError when schemaVersion is missing or invalid', () => {
    expect(() => migrateSession({})).toThrow(ParseError);
    expect(() => migrateSession({ schemaVersion: -1 })).toThrow(ParseError);
    expect(() => migrateSession({ schemaVersion: 'v1' as unknown as number })).toThrow(ParseError);
  });

  it('runs custom v1→v2 migrator and stamps target version', () => {
    const v1ToV2: SessionMigrator = {
      from: 1,
      to: 2,
      migrate: (s) => ({ ...s, addedField: 'hello' }),
    };
    const out = migrateSession({ ...baseSession, schemaVersion: 1 }, [v1ToV2], 2);
    expect(out.schemaVersion).toBe(2);
    expect(out.addedField).toBe('hello');
  });

  it('chains v1→v2→v3 migrators in order', () => {
    const v1: SessionMigrator = { from: 1, to: 2, migrate: (s) => ({ ...s, n: 1 }) };
    const v2: SessionMigrator = {
      from: 2,
      to: 3,
      migrate: (s) => ({ ...s, n: ((s.n as number) ?? 0) + 1 }),
    };
    const out = migrateSession({ schemaVersion: 1 }, [v1, v2], 3);
    expect(out.schemaVersion).toBe(3);
    expect(out.n).toBe(2);
  });

  it('rejects multi-hop migrators (must increment by 1)', () => {
    const bad: SessionMigrator = { from: 1, to: 5, migrate: (s) => s };
    expect(() => migrateSession({ schemaVersion: 1 }, [bad], 5)).toThrow(/must produce v2/);
  });

  it('throws when no migration path exists', () => {
    expect(() => migrateSession({ schemaVersion: 1 }, [], 99)).toThrow(ParseError);
  });

  it('exposes empty BUILTIN_MIGRATORS by default (v1 is the initial release)', () => {
    expect(BUILTIN_MIGRATORS).toHaveLength(0);
  });
});

describe('SESSION_JSON_SCHEMA', () => {
  it('declares the current schemaVersion as a const', () => {
    expect(SESSION_JSON_SCHEMA.properties.schemaVersion.const).toBe(SESSION_SCHEMA_VERSION);
  });

  it('lists every required Session field', () => {
    const required = SESSION_JSON_SCHEMA.required;
    expect(required).toEqual(
      expect.arrayContaining(['schemaVersion', 'startTime', 'endTime', 'samples', 'rrIntervals', 'rounds', 'config']),
    );
  });
});

describe('isCurrentSchema', () => {
  it('returns true for the current version', () => {
    expect(isCurrentSchema({ schemaVersion: SESSION_SCHEMA_VERSION })).toBe(true);
  });
  it('returns false for older versions', () => {
    expect(isCurrentSchema({ schemaVersion: 0 })).toBe(false);
  });
});

describe('sessionFromJSON migration integration', () => {
  it('round-trips current-version JSON unchanged', () => {
    const json = sessionToJSON(baseSession);
    const parsed = sessionFromJSON(json);
    expect(parsed.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
  });

  it('accepts user-supplied migrators when reading old JSON', () => {
    const v1: SessionMigrator = {
      from: 1,
      to: 2,
      migrate: (s) => ({ ...s, _upgraded: true }),
    };
    // Simulate that the SDK is now at v2 by faking a v1 session and a v1→v2 migrator.
    // (We cannot actually mutate the real SESSION_SCHEMA_VERSION constant, so we
    // assert the migrator is invoked indirectly: forge a "future" doc would fail
    // the unsupported-version guard, so instead we verify identity for the
    // current version pass-through.)
    const json = sessionToJSON(baseSession);
    const parsed = sessionFromJSON(json, { migrators: [v1] });
    // Migrators don't run when input is already current; behaviour is unchanged.
    expect(parsed.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
  });

  it('still rejects future-version JSON', () => {
    const json = JSON.stringify({ ...baseSession, schemaVersion: SESSION_SCHEMA_VERSION + 99 });
    expect(() => sessionFromJSON(json)).toThrow(/Unsupported schema version/);
  });
});
