import { describe, expect, it } from 'vitest';
import type { AthleteProfile } from '../zone-presets.js';
import { toSessionConfig, toTRIMPConfig, toZoneConfig, ZONE_PRESETS } from '../zone-presets.js';

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

describe('zone threshold validation', () => {
  it('rejects zones with values outside [0, 1]', () => {
    expect(() => toSessionConfig({ ...athlete, zones: [-0.1, 0.7, 0.8, 0.9] })).toThrow(
      'Zone threshold 0 must be between 0 and 1',
    );
    expect(() => toSessionConfig({ ...athlete, zones: [0.6, 0.7, 0.8, 1.1] })).toThrow(
      'Zone threshold 3 must be between 0 and 1',
    );
  });

  it('rejects non-ascending zone thresholds', () => {
    expect(() => toSessionConfig({ ...athlete, zones: [0.8, 0.7, 0.6, 0.5] })).toThrow('strictly ascending order');
  });

  it('rejects equal adjacent zone thresholds', () => {
    expect(() => toSessionConfig({ ...athlete, zones: [0.6, 0.6, 0.8, 0.9] })).toThrow('strictly ascending order');
  });

  it('does not validate named presets (known-good)', () => {
    expect(() => toSessionConfig({ ...athlete, zones: '5-zone' })).not.toThrow();
    expect(() => toSessionConfig({ ...athlete, zones: '3-zone' })).not.toThrow();
  });

  it('validates custom zones in toZoneConfig', () => {
    expect(() => toZoneConfig({ ...athlete, zones: [0.9, 0.7, 0.8, 0.6] })).toThrow('strictly ascending order');
  });

  it('does not validate named presets in toZoneConfig', () => {
    expect(() => toZoneConfig({ ...athlete, zones: '5-zone' })).not.toThrow();
  });

  it('accepts valid custom zones', () => {
    expect(() => toSessionConfig({ ...athlete, zones: [0.5, 0.65, 0.75, 0.85] })).not.toThrow();
    expect(() => toZoneConfig({ ...athlete, zones: [0.5, 0.65, 0.75, 0.85] })).not.toThrow();
  });
});
