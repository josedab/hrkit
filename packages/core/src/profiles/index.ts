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

export {
  DEXCOM_SHARE_CGM,
  GATT_GLUCOSE_SERVICE_UUID,
  GENERIC_GLUCOSE_METER,
  LIBRE_LINKUP_CGM,
} from './cgm.js';
// Coospo
export { COOSPO_H6, COOSPO_H808S } from './coospo.js';
// Garmin
export { GARMIN_HRM_DUAL, GARMIN_HRM_PRO, GARMIN_HRM_RUN } from './garmin.js';
// Magene
export { MAGENE_H64, MAGENE_H303 } from './magene.js';
// Suunto
export { SUUNTO_SMART_SENSOR } from './suunto.js';

// ── Capability v2: trainers + CGMs ──────────────────────────────────────
export {
  GATT_FTMS_SERVICE_UUID,
  GENERIC_FTMS_TRAINER,
  SARIS_H3,
  TACX_NEO,
  WAHOO_KICKR,
} from './trainers.js';
// Wahoo
export { WAHOO_TICKR, WAHOO_TICKR_FIT, WAHOO_TICKR_X } from './wahoo.js';
