import type { HRZoneConfig, TimestampedHR, ZoneDistribution } from './types.js';

type Zone = 1 | 2 | 3 | 4 | 5;

/**
 * Map a heart rate to a zone (1–5) based on threshold percentages of maxHR.
 * Zones are defined by 4 thresholds, e.g. [0.6, 0.7, 0.8, 0.9]:
 *   Zone 1: < 60% maxHR
 *   Zone 2: 60-70%
 *   Zone 3: 70-80%
 *   Zone 4: 80-90%
 *   Zone 5: >= 90%
 *
 * @param hr - Heart rate in BPM.
 * @param config - Zone configuration with maxHR and zone thresholds.
 * @returns Zone number (1-5).
 *
 * @example
 * ```ts
 * const zone = hrToZone(150, { maxHR: 190, zones: [0.6, 0.7, 0.8, 0.9] });
 * console.log(zone); // 4 (150 is 79% of 190 → zone 4)
 * ```
 */
export function hrToZone(hr: number, config: HRZoneConfig): Zone {
  const thresholds = config.zones.map((z) => z * config.maxHR);

  if (hr >= thresholds[3]!) return 5;
  if (hr >= thresholds[2]!) return 4;
  if (hr >= thresholds[1]!) return 3;
  if (hr >= thresholds[0]!) return 2;
  return 1;
}

/**
 * Compute time-in-zone distribution from timestamped HR samples.
 * Duration for each sample is the delta to the next sample's timestamp.
 *
 * @param samples - Timestamped HR samples.
 * @param config - Zone configuration.
 * @returns Time spent in each zone and total duration.
 */
export function zoneDistribution(samples: TimestampedHR[], config: HRZoneConfig): ZoneDistribution {
  const zones: Record<Zone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const current = samples[i]!;
    const next = samples[i + 1]!;
    const durationSec = (next.timestamp - current.timestamp) / 1000;

    if (durationSec <= 0 || durationSec > 30) continue; // skip gaps > 30s

    const zone = hrToZone(current.hr, config);
    zones[zone] += durationSec;
    total += durationSec;
  }

  return { zones, total };
}
