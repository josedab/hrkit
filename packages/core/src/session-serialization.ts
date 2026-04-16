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

  return obj as unknown as Session;
}

/**
 * Export a Session as CSV text.
 * Each row is a sample with timestamp, HR, and zone (if config is available).
 *
 * @param options.includeRR - Include a column for RR intervals (default: false)
 */
export function sessionToCSV(
  session: Session,
  options?: { includeRR?: boolean },
): string {
  const includeRR = options?.includeRR ?? false;

  const header = includeRR
    ? 'timestamp,hr,rrIntervals'
    : 'timestamp,hr';

  const lines = [header];

  // Build an RR lookup: each sample index maps to the RR intervals that arrived with it.
  // Since Session doesn't store per-sample RR mapping, we distribute them sequentially.
  let rrIndex = 0;

  for (const sample of session.samples) {
    if (includeRR) {
      // Collect RR intervals that fit within this sample's time window
      const rrs: number[] = [];
      while (rrIndex < session.rrIntervals.length && rrs.length < 5) {
        rrs.push(Math.round(session.rrIntervals[rrIndex]! * 100) / 100);
        rrIndex++;
      }
      lines.push(`${sample.timestamp},${sample.hr},"${rrs.join(';')}"`);
    } else {
      lines.push(`${sample.timestamp},${sample.hr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Export rounds as CSV text for per-round analysis.
 * Each row is a round with index, start, end, duration, sample count, and metadata label.
 */
export function roundsToCSV(session: Session): string {
  const header = 'index,startTime,endTime,durationSec,sampleCount,rrCount,label';
  const lines = [header];

  for (const round of session.rounds) {
    const duration = ((round.endTime - round.startTime) / 1000).toFixed(1);
    const label = round.meta?.label ?? '';
    lines.push(
      `${round.index},${round.startTime},${round.endTime},${duration},${round.samples.length},${round.rrIntervals.length},"${label}"`,
    );
  }

  return lines.join('\n');
}
