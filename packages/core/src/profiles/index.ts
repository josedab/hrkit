import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/**
 * Generic BLE HR sensor profile. Matches any device advertising the standard
 * Heart Rate service (empty `namePrefix` matches all names).
 */
export const GENERIC_HR: DeviceProfile = {
  brand: 'Generic',
  model: 'BLE HR sensor',
  namePrefix: '',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

// Garmin
export { GARMIN_HRM_PRO, GARMIN_HRM_DUAL, GARMIN_HRM_RUN } from './garmin.js';

// Wahoo
export { WAHOO_TICKR, WAHOO_TICKR_X, WAHOO_TICKR_FIT } from './wahoo.js';

// Magene
export { MAGENE_H64, MAGENE_H303 } from './magene.js';

// Suunto
export { SUUNTO_SMART_SENSOR } from './suunto.js';

// Coospo
export { COOSPO_H6, COOSPO_H808S } from './coospo.js';
