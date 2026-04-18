import { HRKitError } from './errors.js';
import type { HRZoneConfig, SessionConfig, TRIMPConfig } from './types.js';

/** Named zone preset identifiers. */
export type ZonePreset = '5-zone' | '3-zone';

/** Built-in zone threshold presets. */
export const ZONE_PRESETS: Record<ZonePreset, [number, number, number, number]> = {
  /** Standard 5-zone model: recovery, aerobic, tempo, threshold, anaerobic. */
  '5-zone': [0.6, 0.7, 0.8, 0.9],
  /** Simplified 3-zone model: easy (<70%), moderate (70-85%), hard (>85%). Zones 1-2 merge, 3-4 merge. */
  '3-zone': [0.7, 0.85, 0.95, 1.0],
};

/**
 * Unified athlete profile that can derive all SDK config types.
 * Use this as a single source of truth instead of maintaining separate configs.
 */
export interface AthleteProfile {
  maxHR: number;
  restHR: number;
  sex: 'male' | 'female' | 'neutral';
  /** Zone preset or custom thresholds. Default: '5-zone'. */
  zones?: ZonePreset | [number, number, number, number];
}

function validateZoneThresholds(zones: [number, number, number, number]): void {
  for (let i = 0; i < 4; i++) {
    if (zones[i]! < 0 || zones[i]! > 1) {
      throw new HRKitError(`Zone threshold ${i} must be between 0 and 1, got ${zones[i]}`);
    }
  }
  if (zones[0] >= zones[1] || zones[1] >= zones[2] || zones[2] >= zones[3]) {
    throw new HRKitError('Zone thresholds must be in strictly ascending order');
  }
}

/**
 * Derive a SessionConfig from an AthleteProfile.
 *
 * @param profile - Athlete profile to derive config from.
 * @returns SessionConfig suitable for SessionRecorder.
 *
 * @example
 * ```ts
 * const config = toSessionConfig({ maxHR: 190, restHR: 55, sex: 'male', zones: '5-zone' });
 * const recorder = new SessionRecorder(config);
 * ```
 */
export function toSessionConfig(profile: AthleteProfile): SessionConfig {
  const zones =
    typeof profile.zones === 'string' ? ZONE_PRESETS[profile.zones] : (profile.zones ?? ZONE_PRESETS['5-zone']);

  // Validate custom zone thresholds (named presets are known-good)
  if (typeof profile.zones !== 'string' && profile.zones !== undefined) {
    validateZoneThresholds(zones);
  }

  return {
    maxHR: profile.maxHR,
    restHR: profile.restHR,
    sex: profile.sex,
    zones,
  };
}

/**
 * Derive an HRZoneConfig from an AthleteProfile.
 *
 * @param profile - Athlete profile.
 * @returns HRZoneConfig for zone calculations.
 *
 * @example
 * ```ts
 * const zoneConfig = toZoneConfig({ maxHR: 190, restHR: 55, sex: 'male' });
 * const zone = hrToZone(150, zoneConfig);
 * ```
 */
export function toZoneConfig(profile: AthleteProfile): HRZoneConfig {
  const zones =
    typeof profile.zones === 'string' ? ZONE_PRESETS[profile.zones] : (profile.zones ?? ZONE_PRESETS['5-zone']);

  // Validate custom zone thresholds (named presets are known-good)
  if (typeof profile.zones !== 'string' && profile.zones !== undefined) {
    validateZoneThresholds(zones);
  }

  return { maxHR: profile.maxHR, restHR: profile.restHR, zones };
}

/**
 * Derive a TRIMPConfig from an AthleteProfile.
 *
 * @param profile - Athlete profile.
 * @returns TRIMPConfig for TRIMP calculations.
 *
 * @example
 * ```ts
 * const trimpConfig = toTRIMPConfig({ maxHR: 190, restHR: 55, sex: 'male' });
 * const load = trimp(session.samples, trimpConfig);
 * ```
 */
export function toTRIMPConfig(profile: AthleteProfile): TRIMPConfig {
  return { maxHR: profile.maxHR, restHR: profile.restHR, sex: profile.sex };
}
