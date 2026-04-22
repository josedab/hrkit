import { ParseError } from './errors.js';
import { migrateSession, type SessionMigrator } from './session-migrations.js';
import type { Session } from './types.js';
import { SESSION_SCHEMA_VERSION } from './types.js';

/**
 * Serialize a Session to a JSON string.
 * Includes schema version for forward compatibility.
 *
 * @param session - The session to serialize.
 * @returns JSON string.
 *
 * @example
 * ```ts
 * const json = sessionToJSON(session);
 * localStorage.setItem('session', json);
 * ```
 */
export function sessionToJSON(session: Session): string {
  return JSON.stringify(session);
}

/**
 * Options for {@link sessionFromJSON}.
 */
export interface SessionFromJSONOptions {
  /**
   * When true, validate every sample and round (not just the first one).
   * Defaults to false to preserve the fast O(1) path. Recommended when
   * deserializing untrusted JSON (e.g. from network or user upload), since
   * a malformed sample at index N>0 would otherwise pass validation and
   * crash downstream code that assumes well-typed fields.
   */
  strict?: boolean;
  /**
   * Custom migrators applied in addition to the built-ins. Useful for
   * downstream consumers who store extended session shapes and want to keep
   * historical files readable without forking @hrkit/core.
   */
  migrators?: readonly SessionMigrator[];
}

/**
 * Deserialize a Session from a JSON string.
 * Validates schema version and required fields.
 *
 * @param json - JSON string produced by {@link sessionToJSON}.
 * @param options - Optional deserialization options. Pass `{ strict: true }` to
 *   validate every sample and round (slower; use for untrusted input).
 * @returns Deserialized and validated Session.
 * @throws {ParseError} if the JSON is invalid or schema version is unsupported.
 *
 * @example
 * ```ts
 * const session = sessionFromJSON(json, { strict: true });
 * const analysis = analyzeSession(session);
 * ```
 */
export function sessionFromJSON(json: string, options?: SessionFromJSONOptions): Session {
  const strict = options?.strict ?? false;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    const detail = err instanceof Error ? `: ${err.message}` : '';
    throw new ParseError(`Invalid JSON: unable to parse session data${detail}`);
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new ParseError('Invalid session data: expected an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'number') {
    throw new ParseError('Missing or invalid schemaVersion field');
  }

  if (obj.schemaVersion > SESSION_SCHEMA_VERSION) {
    throw new ParseError(
      `Unsupported schema version ${obj.schemaVersion}. ` +
        `This SDK supports up to version ${SESSION_SCHEMA_VERSION}. ` +
        `Please upgrade @hrkit/core.`,
    );
  }

  // Run version-by-version migrations if older than the current schema.
  const migrated = obj.schemaVersion < SESSION_SCHEMA_VERSION ? migrateSession(obj, options?.migrators) : obj;

  // Validate required fields
  const requiredFields = ['startTime', 'endTime', 'samples', 'rrIntervals', 'rounds', 'config'] as const;
  for (const field of requiredFields) {
    if (!(field in migrated)) {
      throw new ParseError(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(migrated.samples)) {
    throw new ParseError('Invalid session data: samples must be an array');
  }

  if (!Array.isArray(migrated.rrIntervals)) {
    throw new ParseError('Invalid session data: rrIntervals must be an array');
  }

  if (!Array.isArray(migrated.rounds)) {
    throw new ParseError('Invalid session data: rounds must be an array');
  }

  // Validate sample shapes — first sample always; all samples in strict mode.
  const samples = migrated.samples as unknown[];
  const sampleCheckLimit = strict ? samples.length : Math.min(samples.length, 1);
  for (let i = 0; i < sampleCheckLimit; i++) {
    const s = samples[i];
    if (
      typeof s !== 'object' ||
      s === null ||
      typeof (s as Record<string, unknown>).timestamp !== 'number' ||
      typeof (s as Record<string, unknown>).hr !== 'number'
    ) {
      throw new ParseError(
        i === 0
          ? 'Invalid session data: samples must contain objects with timestamp and hr fields'
          : `Invalid session data: samples[${i}] must be an object with numeric timestamp and hr fields`,
      );
    }
  }

  // Validate RR interval types — first element always; all elements in strict mode.
  const rr = migrated.rrIntervals as unknown[];
  if (rr.length > 0 && typeof rr[0] !== 'number') {
    throw new ParseError('Invalid session data: rrIntervals must contain numbers');
  }
  if (strict) {
    for (let i = 1; i < rr.length; i++) {
      if (typeof rr[i] !== 'number') {
        throw new ParseError(`Invalid session data: rrIntervals[${i}] must be a number`);
      }
    }
  }

  // Validate round shapes — first round always; all rounds in strict mode.
  const rounds = migrated.rounds as unknown[];
  const roundCheckLimit = strict ? rounds.length : Math.min(rounds.length, 1);
  for (let i = 0; i < roundCheckLimit; i++) {
    const r = rounds[i];
    if (
      typeof r !== 'object' ||
      r === null ||
      typeof (r as Record<string, unknown>).index !== 'number' ||
      typeof (r as Record<string, unknown>).startTime !== 'number' ||
      typeof (r as Record<string, unknown>).endTime !== 'number'
    ) {
      throw new ParseError(
        i === 0
          ? 'Invalid session data: rounds must contain objects with index, startTime, and endTime fields'
          : `Invalid session data: rounds[${i}] must be an object with index, startTime, and endTime fields`,
      );
    }
  }

  // Validate config shape
  const config = migrated.config;
  if (typeof config !== 'object' || config === null || typeof (config as Record<string, unknown>).maxHR !== 'number') {
    throw new ParseError('Invalid session data: config must contain a maxHR field');
  }

  // Validate time ordering
  if (typeof migrated.startTime === 'number' && typeof migrated.endTime === 'number') {
    if (migrated.endTime < migrated.startTime) {
      throw new ParseError('Invalid session data: endTime must be >= startTime');
    }
  }

  return migrated as unknown as Session;
}

/**
 * Export a Session as CSV text.
 * Each row is a sample with timestamp and HR.
 *
 * @param session - The session to export.
 * @returns CSV string with header row `timestamp,hr`.
 *
 * @example
 * ```typescript
 * const csv = sessionToCSV(session);
 * ```
 */
export function sessionToCSV(session: Session): string {
  const header = 'timestamp,hr';
  const lines = [header];

  for (const sample of session.samples) {
    lines.push(`${sample.timestamp},${sample.hr}`);
  }

  return lines.join('\n');
}

/**
 * Export rounds as CSV text for per-round analysis.
 * Each row is a round with index, start, end, duration, sample count, and metadata label.
 *
 * @param session - The session whose rounds to export.
 * @returns CSV string with header row `index,startTime,endTime,durationSec,sampleCount,rrCount,label`.
 *
 * @example
 * ```typescript
 * const csv = roundsToCSV(session);
 * ```
 */
export function roundsToCSV(session: Session): string {
  const header = 'index,startTime,endTime,durationSec,sampleCount,rrCount,label';
  const lines = [header];

  for (const round of session.rounds) {
    const duration = ((round.endTime - round.startTime) / 1000).toFixed(1);
    const label = (round.meta?.label ?? '').replace(/"/g, '""');
    lines.push(
      `${round.index},${round.startTime},${round.endTime},${duration},${round.samples.length},${round.rrIntervals.length},"${label.replace(/\n/g, ' ')}"`,
    );
  }

  return lines.join('\n');
}
