import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/** Garmin HRM-Pro / HRM-Pro Plus chest strap. */
export const GARMIN_HRM_PRO: DeviceProfile = {
  brand: 'Garmin',
  model: 'HRM-Pro',
  namePrefix: 'HRM-Pro',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Garmin HRM-Dual chest strap (ANT+ and BLE). */
export const GARMIN_HRM_DUAL: DeviceProfile = {
  brand: 'Garmin',
  model: 'HRM-Dual',
  namePrefix: 'HRM-Dual',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Garmin HRM-Run chest strap with running dynamics. */
export const GARMIN_HRM_RUN: DeviceProfile = {
  brand: 'Garmin',
  model: 'HRM-Run',
  namePrefix: 'HRM-Run',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
