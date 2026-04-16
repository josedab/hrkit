import type { Session, TimestampedHR } from './types.js';

/**
 * Export a Session as a TCX (Training Center XML) document.
 * Compatible with Strava, Garmin Connect, TrainingPeaks, and other platforms.
 *
 * @param session - The completed session to export.
 * @param options - Optional export configuration.
 * @param options.sport - Activity sport type. Default: 'Other'.
 * @param options.includeRR - Include RR intervals in TCX extensions. Default: true.
 * @param options.includeCalories - Include estimated calories. Default: true.
 * @returns TCX XML string.
 *
 * @example
 * ```typescript
 * const tcx = sessionToTCX(session, { sport: 'Biking' });
 * fs.writeFileSync('workout.tcx', tcx);
 * ```
 */
export function sessionToTCX(
  session: Session,
  options?: {
    sport?: string;
    /** Include RR intervals in TCX extensions. Default: true. */
    includeRR?: boolean;
    /** Include estimated calories. Default: true. */
    includeCalories?: boolean;
  },
): string {
  const sport = options?.sport ?? 'Other';
  const includeRR = options?.includeRR ?? true;
  const includeCalories = options?.includeCalories ?? true;
  const startISO = new Date(session.startTime).toISOString();

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">',
    '  <Activities>',
    `    <Activity Sport="${escapeXml(sport)}">`,
    `      <Id>${startISO}</Id>`,
  ];

  if (session.rounds.length > 0) {
    for (const round of session.rounds) {
      const roundSamples = session.samples.filter(
        (s) => s.timestamp >= round.startTime && s.timestamp <= round.endTime,
      );
      const roundDurationSec = (round.endTime - round.startTime) / 1000;
      const roundStartISO = new Date(round.startTime).toISOString();

      appendLap(lines, roundStartISO, roundDurationSec, roundSamples, includeCalories);

      if (includeRR && round.rrIntervals.length > 0) {
        appendRRExtension(lines, round.rrIntervals, '      ');
      }

      lines.push('      </Lap>');
    }
  } else {
    const durationSec = (session.endTime - session.startTime) / 1000;
    appendLap(lines, startISO, durationSec, session.samples, includeCalories);

    if (includeRR && session.rrIntervals.length > 0) {
      appendRRExtension(lines, session.rrIntervals, '      ');
    }

    lines.push('      </Lap>');
  }

  lines.push('    </Activity>');
  lines.push('  </Activities>');
  lines.push('</TrainingCenterDatabase>');

  return lines.join('\n');
}

function appendLap(
  lines: string[],
  startISO: string,
  durationSec: number,
  samples: TimestampedHR[],
  includeCalories: boolean,
): void {
  lines.push(`      <Lap StartTime="${startISO}">`);
  lines.push(`        <TotalTimeSeconds>${durationSec.toFixed(1)}</TotalTimeSeconds>`);

  if (includeCalories) {
    const calories = estimateCalories(durationSec, samples);
    lines.push(`        <Calories>${Math.round(calories)}</Calories>`);
  }

  lines.push('        <Intensity>Active</Intensity>');
  lines.push('        <TriggerMethod>Manual</TriggerMethod>');
  lines.push('        <Track>');

  for (const sample of samples) {
    const time = new Date(sample.timestamp).toISOString();
    lines.push('          <Trackpoint>');
    lines.push(`            <Time>${time}</Time>`);
    lines.push('            <HeartRateBpm>');
    lines.push(`              <Value>${Math.round(sample.hr)}</Value>`);
    lines.push('            </HeartRateBpm>');
    lines.push('          </Trackpoint>');
  }

  lines.push('        </Track>');
}

function appendRRExtension(lines: string[], rrIntervals: number[], indent: string): void {
  lines.push(`${indent}  <Extensions>`);
  lines.push(`${indent}    <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">`);
  lines.push(`${indent}      <RRIntervals>`);
  for (const rr of rrIntervals) {
    lines.push(`${indent}        <RR>${Math.round(rr)}</RR>`);
  }
  lines.push(`${indent}      </RRIntervals>`);
  lines.push(`${indent}    </TPX>`);
  lines.push(`${indent}  </Extensions>`);
}

function estimateCalories(durationSec: number, samples: TimestampedHR[]): number {
  if (samples.length === 0) return 0;
  const avgHR = samples.reduce((sum, s) => sum + s.hr, 0) / samples.length;
  const durationMin = durationSec / 60;
  return Math.max(0, (durationMin * (avgHR * 0.6309 - 30.4523)) / 60);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
