import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/** Wahoo TICKR heart rate monitor. */
export const WAHOO_TICKR: DeviceProfile = {
  brand: 'Wahoo',
  model: 'TICKR',
  namePrefix: 'TICKR',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Wahoo TICKR X heart rate monitor with memory. */
export const WAHOO_TICKR_X: DeviceProfile = {
  brand: 'Wahoo',
  model: 'TICKR X',
  namePrefix: 'TICKR X',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Wahoo TICKR FIT heart rate monitor. */
export const WAHOO_TICKR_FIT: DeviceProfile = {
  brand: 'Wahoo',
  model: 'TICKR FIT',
  namePrefix: 'TICKR FIT',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
