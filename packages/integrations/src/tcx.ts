import type { Session } from '@hrkit/core';

/**
 * Garmin Training Center XML (TCX) writer.
 *
 * Produces a minimal but spec-conformant `Activities` document accepted by
 * Garmin Connect, Strava, TrainingPeaks, intervals.icu, and most coaching
 * platforms. Only fields available from a {@link Session} are emitted; GPS
 * tracks are omitted (use FIT for those).
 */

export interface TcxOptions {
  sport?: 'Running' | 'Biking' | 'Other';
  activityId?: string;
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );
}

function isoStamp(ms: number): string {
  return new Date(ms).toISOString();
}

export function sessionToTCX(session: Session, opts: TcxOptions = {}): string {
  const sport = opts.sport ?? 'Other';
  const startMs = session.startTime ?? session.samples[0]?.timestamp ?? Date.now();
  const activityId = opts.activityId ?? isoStamp(startMs);
  const totalSec =
    session.endTime != null &&
    session.startTime != null &&
    Number.isFinite(session.endTime) &&
    Number.isFinite(session.startTime)
      ? (session.endTime - session.startTime) / 1000
      : 0;

  const trackpoints = session.samples
    .map((s) => {
      const hr = Number.isFinite(s.hr) ? Math.max(0, Math.min(255, Math.round(s.hr))) : 0;
      return `        <Trackpoint>
          <Time>${isoStamp(s.timestamp)}</Time>
          <HeartRateBpm><Value>${hr}</Value></HeartRateBpm>
        </Trackpoint>`;
    })
    .join('\n');

  const validSamples = session.samples.filter((s) => Number.isFinite(s.hr));
  const avgHr =
    validSamples.length > 0 ? Math.round(validSamples.reduce((a, s) => a + s.hr, 0) / validSamples.length) : 0;
  const maxHr = validSamples.reduce((m, s) => Math.max(m, s.hr), 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${escapeXml(activityId)}</Id>
      <Lap StartTime="${isoStamp(startMs)}">
        <TotalTimeSeconds>${totalSec.toFixed(2)}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>0</Calories>
        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>${maxHr}</Value></MaximumHeartRateBpm>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>@hrkit</Name>
        <UnitId>0</UnitId>
        <ProductID>0</ProductID>
        <Version><VersionMajor>0</VersionMajor><VersionMinor>1</VersionMinor><BuildMajor>0</BuildMajor><BuildMinor>0</BuildMinor></Version>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}
