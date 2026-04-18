import { ParseError } from './errors.js';
import type { Session } from './types.js';
import { SESSION_SCHEMA_VERSION } from './types.js';

/**
 * Versioned migration of historical Session JSON shapes to the latest schema.
 *
 * Each migrator promotes a single version `from -> from+1`. They are applied
 * in order, so adding a v3 migrator never requires touching the v2 one.
 *
 * Why a separate module: the JSON-on-disk format outlives any single SDK
 * version. Without a migration toolkit, a v0.2 release that bumped
 * {@link SESSION_SCHEMA_VERSION} would silently break any user who replays a
 * v0.1 fixture. This module is the contract.
 *
 * @see [Wire Format Spec](../../docs/wire-format.md) for the canonical
 * version-by-version field reference.
 */
export interface SessionMigrator {
  /** Source schema version this migrator consumes. */
  from: number;
  /** Resulting schema version after the migrator runs. */
  to: number;
  /**
   * Pure transform from `from` shape to `to` shape. Receives the raw object
   * (already validated as `schemaVersion === from`); returns the upgraded
   * object. Must not mutate the input.
   */
  migrate(input: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Built-in migrators. Append new ones here, ordered by `from` ascending.
 *
 * Currently empty because v1 is the initial released schema. The first real
 * migrator (v1 → v2) will land alongside the next breaking change.
 */
export const BUILTIN_MIGRATORS: readonly SessionMigrator[] = [];

/**
 * Apply all registered migrators to bring a parsed Session up to a target
 * schema version (defaulting to the current {@link SESSION_SCHEMA_VERSION}).
 *
 * @param raw - Parsed JSON object (already known to be a non-null object).
 * @param migrators - Migrators to consider. Defaults to {@link BUILTIN_MIGRATORS}.
 * @param targetVersion - Stop when this version is reached. Exposed so future
 *   tooling (and tests) can drive the chain to an arbitrary version without
 *   having to bump the global constant. Defaults to {@link SESSION_SCHEMA_VERSION}.
 * @returns The upgraded object, or `raw` unchanged if already at target.
 * @throws {ParseError} when no migration path exists from the input version.
 */
export function migrateSession(
  raw: Record<string, unknown>,
  migrators: readonly SessionMigrator[] = BUILTIN_MIGRATORS,
  targetVersion: number = SESSION_SCHEMA_VERSION,
): Record<string, unknown> {
  let current = raw;
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : NaN;

  if (!Number.isFinite(version) || version < 1) {
    throw new ParseError(`Cannot migrate session: missing or invalid schemaVersion (${String(current.schemaVersion)})`);
  }

  // Bound the migration loop to prevent infinite cycles from a buggy migrator.
  const MAX_HOPS = 64;
  let hops = 0;

  while (version < targetVersion) {
    const next = migrators.find((m) => m.from === version);
    if (!next) {
      throw new ParseError(
        `No migration path from session schemaVersion ${version} to ${targetVersion}. ` +
          `Upgrade @hrkit/core or supply a custom migrator.`,
      );
    }
    if (next.to !== version + 1) {
      // Defensive: refuse multi-hop migrators so each step is auditable.
      throw new ParseError(`Migrator from v${next.from} must produce v${next.from + 1}, got v${next.to}`);
    }
    current = { ...next.migrate(current), schemaVersion: next.to };
    version = next.to;
    if (++hops > MAX_HOPS) {
      throw new ParseError(`Migration exceeded ${MAX_HOPS} hops; aborting to prevent loop`);
    }
  }

  return current;
}

/**
 * JSON Schema (draft-2020-12) for the current Session wire format. Embedded
 * here (rather than published as a `.json`) so consumers get the same shape
 * regardless of how they install — and so we can refuse drift via a test that
 * compares the schema's fields against the TypeScript `Session` keys.
 */
export const SESSION_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://hrkit.dev/schemas/session/v${SESSION_SCHEMA_VERSION}.json`,
  title: 'Session',
  type: 'object',
  required: ['schemaVersion', 'startTime', 'endTime', 'samples', 'rrIntervals', 'rounds', 'config'],
  properties: {
    schemaVersion: { type: 'integer', const: SESSION_SCHEMA_VERSION },
    startTime: { type: 'number' },
    endTime: { type: 'number' },
    samples: {
      type: 'array',
      items: {
        type: 'object',
        required: ['timestamp', 'hr'],
        properties: {
          timestamp: { type: 'number' },
          hr: { type: 'number', minimum: 0, maximum: 300 },
        },
      },
    },
    rrIntervals: { type: 'array', items: { type: 'number', minimum: 0 } },
    rounds: {
      type: 'array',
      items: {
        type: 'object',
        required: ['index', 'startTime', 'endTime'],
        properties: {
          index: { type: 'integer', minimum: 0 },
          startTime: { type: 'number' },
          endTime: { type: 'number' },
        },
      },
    },
    config: {
      type: 'object',
      required: ['maxHR'],
      properties: { maxHR: { type: 'number', exclusiveMinimum: 0 } },
    },
    deviceInfo: { type: 'object' },
    metadata: { type: 'object' },
  },
  additionalProperties: true,
} as const;

/**
 * Type guard helper used by tests / consumers that want a strict shape check
 * after migration.
 */
export function isCurrentSchema(s: Record<string, unknown>): s is Session & Record<string, unknown> {
  return s.schemaVersion === SESSION_SCHEMA_VERSION;
}
