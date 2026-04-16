import { describe, it, expect } from 'vitest';
import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';
import {
  GENERIC_HR,
  GARMIN_HRM_PRO,
  GARMIN_HRM_DUAL,
  GARMIN_HRM_RUN,
  WAHOO_TICKR,
  WAHOO_TICKR_X,
  WAHOO_TICKR_FIT,
  MAGENE_H64,
  MAGENE_H303,
  SUUNTO_SMART_SENSOR,
  COOSPO_H6,
  COOSPO_H808S,
} from '../profiles/index.js';

const ALL_PROFILES: DeviceProfile[] = [
  GENERIC_HR,
  GARMIN_HRM_PRO,
  GARMIN_HRM_DUAL,
  GARMIN_HRM_RUN,
  WAHOO_TICKR,
  WAHOO_TICKR_X,
  WAHOO_TICKR_FIT,
  MAGENE_H64,
  MAGENE_H303,
  SUUNTO_SMART_SENSOR,
  COOSPO_H6,
  COOSPO_H808S,
];

const BRAND_PROFILES = ALL_PROFILES.filter((p) => p !== GENERIC_HR);

describe('Device profiles', () => {
  it.each(ALL_PROFILES.map((p) => [p.brand + ' ' + p.model, p]))(
    '%s has all required fields',
    (_label, profile) => {
      const p = profile as DeviceProfile;
      expect(typeof p.brand).toBe('string');
      expect(p.brand.length).toBeGreaterThan(0);
      expect(typeof p.model).toBe('string');
      expect(p.model.length).toBeGreaterThan(0);
      expect(typeof p.namePrefix).toBe('string');
      expect(Array.isArray(p.capabilities)).toBe(true);
      expect(p.capabilities.length).toBeGreaterThan(0);
      expect(Array.isArray(p.serviceUUIDs)).toBe(true);
      expect(p.serviceUUIDs.length).toBeGreaterThan(0);
    },
  );

  it.each(ALL_PROFILES.map((p) => [p.brand + ' ' + p.model, p]))(
    '%s includes GATT HR service UUID',
    (_label, profile) => {
      const p = profile as DeviceProfile;
      expect(p.serviceUUIDs).toContain(GATT_HR_SERVICE_UUID);
    },
  );

  it.each(ALL_PROFILES.map((p) => [p.brand + ' ' + p.model, p]))(
    '%s includes heartRate capability',
    (_label, profile) => {
      const p = profile as DeviceProfile;
      expect(p.capabilities).toContain('heartRate');
    },
  );

  it.each(BRAND_PROFILES.map((p) => [p.brand + ' ' + p.model, p]))(
    '%s has a non-empty namePrefix',
    (_label, profile) => {
      const p = profile as DeviceProfile;
      expect(p.namePrefix.length).toBeGreaterThan(0);
    },
  );

  it('GENERIC_HR has an empty namePrefix', () => {
    expect(GENERIC_HR.namePrefix).toBe('');
  });

  it('has no duplicate namePrefix values across brand profiles', () => {
    const prefixes = BRAND_PROFILES.map((p) => p.namePrefix);
    const unique = new Set(prefixes);
    expect(unique.size).toBe(prefixes.length);
  });
});
