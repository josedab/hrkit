import type { Session } from './types.js';
import { SESSION_SCHEMA_VERSION } from './types.js';
import { ParseError } from './errors.js';

/**
 * Serialize a Session to a JSON string.
 * Includes schema version for forward compatibility.
 */
export function sessionToJSON(session: Session): string {
  return JSON.stringify(session);
}

/**
 * Deserialize a Session from a JSON string.
 * Validates schema version and required fields.
 *
 * @throws {ParseError} if the JSON is invalid or schema version is unsupported.
 */
export function sessionFromJSON(json: string): Session {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ParseError('Invalid JSON: unable to parse session data');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new ParseError('Invalid session data: expected an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['schemaVersion'] !== 'number') {
    throw new ParseError('Missing or invalid schemaVersion field');
  }

  if (obj['schemaVersion'] > SESSION_SCHEMA_VERSION) {
    throw new ParseError(
      `Unsupported schema version ${obj['schemaVersion']}. ` +
      `This SDK supports up to version ${SESSION_SCHEMA_VERSION}. ` +
      `Please upgrade @hrkit/core.`,
    );
  }

  // Validate required fields
  const requiredFields = ['startTime', 'endTime', 'samples', 'rrIntervals', 'rounds', 'config'] as const;
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new ParseError(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(obj['samples'])) {
    throw new ParseError('Invalid session data: samples must be an array');
  }

  if (!Array.isArray(obj['rrIntervals'])) {
    throw new ParseError('Invalid session data: rrIntervals must be an array');
  }

  if (!Array.isArray(obj['rounds'])) {
    throw new ParseError('Invalid session data: rounds must be an array');
  }

  // Validate sample shapes
  const samples = obj['samples'] as unknown[];
  for (let i = 0; i < Math.min(samples.length, 1); i++) {
    const s = samples[i];
    if (typeof s !== 'object' || s === null ||
        typeof (s as Record<string, unknown>)['timestamp'] !== 'number' ||
        typeof (s as Record<string, unknown>)['hr'] !== 'number') {
      throw new ParseError('Invalid session data: samples must contain objects with timestamp and hr fields');
    }
  }

  // Validate RR interval types
  const rr = obj['rrIntervals'] as unknown[];
  if (rr.length > 0 && typeof rr[0] !== 'number') {
    throw new ParseError('Invalid session data: rrIntervals must contain numbers');
  }

  // Validate round shapes
  const rounds = obj['rounds'] as unknown[];
  for (let i = 0; i < Math.min(rounds.length, 1); i++) {
    const r = rounds[i];
    if (typeof r !== 'object' || r === null ||
        typeof (r as Record<string, unknown>)['index'] !== 'number' ||
        typeof (r as Record<string, unknown>)['startTime'] !== 'number' ||
        typeof (r as Record<string, unknown>)['endTime'] !== 'number') {
      throw new ParseError('Invalid session data: rounds must contain objects with index, startTime, and endTime fields');
    }
  }

  // Validate config shape
  const config = obj['config'];
  if (typeof config !== 'object' || config === null ||
      typeof (config as Record<string, unknown>)['maxHR'] !== 'number') {
    throw new ParseError('Invalid session data: config must contain a maxHR field');
  }

  // Validate time ordering
  if (typeof obj['startTime'] === 'number' && typeof obj['endTime'] === 'number') {
    if (obj['endTime'] < obj['startTime']) {
      throw new ParseError('Invalid session data: endTime must be >= startTime');
    }
  }

  return obj as unknown as Session;
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
