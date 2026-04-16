import type { Session } from './types.js';

/**
 * Export a Session as a TCX (Training Center XML) document.
 * Compatible with Strava, Garmin Connect, TrainingPeaks, and other platforms.
 *
 * @param options.sport Activity sport type. Default: 'Other'.
 */
export function sessionToTCX(
  session: Session,
  options?: { sport?: string },
): string {
  const sport = options?.sport ?? 'Other';
  const startISO = new Date(session.startTime).toISOString();
  const durationSec = (session.endTime - session.startTime) / 1000;

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">',
    '  <Activities>',
    `    <Activity Sport="${escapeXml(sport)}">`,
    `      <Id>${startISO}</Id>`,
    `      <Lap StartTime="${startISO}">`,
    `        <TotalTimeSeconds>${durationSec.toFixed(1)}</TotalTimeSeconds>`,
    '        <Intensity>Active</Intensity>',
    '        <TriggerMethod>Manual</TriggerMethod>',
    '        <Track>',
  ];

  for (const sample of session.samples) {
    const time = new Date(sample.timestamp).toISOString();
    lines.push('          <Trackpoint>');
    lines.push(`            <Time>${time}</Time>`);
    lines.push('            <HeartRateBpm>');
    lines.push(`              <Value>${Math.round(sample.hr)}</Value>`);
    lines.push('            </HeartRateBpm>');
    lines.push('          </Trackpoint>');
  }

  lines.push('        </Track>');
  lines.push('      </Lap>');
  lines.push('    </Activity>');
  lines.push('  </Activities>');
  lines.push('</TrainingCenterDatabase>');

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
