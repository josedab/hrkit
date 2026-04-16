import { describe, it, expect } from 'vitest';
import {
  ZONE_PRESETS,
  toSessionConfig,
  toZoneConfig,
  toTRIMPConfig,
} from '../zone-presets.js';
import type { AthleteProfile } from '../zone-presets.js';

const athlete: AthleteProfile = {
  maxHR: 185,
  restHR: 48,
  sex: 'male',
};

describe('ZONE_PRESETS', () => {
  it('5-zone preset has 4 thresholds', () => {
    const z = ZONE_PRESETS['5-zone'];
    expect(z).toHaveLength(4);
    expect(z[0]).toBe(0.6);
    expect(z[3]).toBe(0.9);
  });

  it('3-zone preset has 4 thresholds (upper zones merged)', () => {
    const z = ZONE_PRESETS['3-zone'];
    expect(z).toHaveLength(4);
    expect(z[0]).toBe(0.7);
  });

  it('presets are sorted ascending', () => {
    for (const [, thresholds] of Object.entries(ZONE_PRESETS)) {
      for (let i = 1; i < thresholds.length; i++) {
        expect(thresholds[i]).toBeGreaterThanOrEqual(thresholds[i - 1]!);
      }
    }
  });
});

describe('toSessionConfig', () => {
  it('derives SessionConfig from AthleteProfile', () => {
    const config = toSessionConfig(athlete);
    expect(config.maxHR).toBe(185);
    expect(config.restHR).toBe(48);
    expect(config.sex).toBe('male');
    expect(config.zones).toEqual([0.6, 0.7, 0.8, 0.9]); // 5-zone default
  });

  it('uses named zone preset', () => {
    const config = toSessionConfig({ ...athlete, zones: '3-zone' });
    expect(config.zones).toEqual(ZONE_PRESETS['3-zone']);
  });

  it('uses custom zone thresholds', () => {
    const custom: [number, number, number, number] = [0.5, 0.65, 0.75, 0.85];
    const config = toSessionConfig({ ...athlete, zones: custom });
    expect(config.zones).toEqual(custom);
  });
});

describe('toZoneConfig', () => {
  it('derives HRZoneConfig', () => {
    const config = toZoneConfig(athlete);
    expect(config.maxHR).toBe(185);
    expect(config.restHR).toBe(48);
    expect(config.zones).toEqual([0.6, 0.7, 0.8, 0.9]);
  });
});

describe('toTRIMPConfig', () => {
  it('derives TRIMPConfig', () => {
    const config = toTRIMPConfig(athlete);
    expect(config.maxHR).toBe(185);
    expect(config.restHR).toBe(48);
    expect(config.sex).toBe('male');
  });
});
