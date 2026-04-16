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

/** Derive a SessionConfig from an AthleteProfile. */
export function toSessionConfig(profile: AthleteProfile): SessionConfig {
  const zones = typeof profile.zones === 'string'
    ? ZONE_PRESETS[profile.zones]
    : profile.zones ?? ZONE_PRESETS['5-zone'];

  return {
    maxHR: profile.maxHR,
    restHR: profile.restHR,
    sex: profile.sex,
    zones,
  };
}

/** Derive an HRZoneConfig from an AthleteProfile. */
export function toZoneConfig(profile: AthleteProfile): HRZoneConfig {
  const zones = typeof profile.zones === 'string'
    ? ZONE_PRESETS[profile.zones]
    : profile.zones ?? ZONE_PRESETS['5-zone'];

  return { maxHR: profile.maxHR, restHR: profile.restHR, zones };
}

/** Derive a TRIMPConfig from an AthleteProfile. */
export function toTRIMPConfig(profile: AthleteProfile): TRIMPConfig {
  return { maxHR: profile.maxHR, restHR: profile.restHR, sex: profile.sex };
}
