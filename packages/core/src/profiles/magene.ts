import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/** Magene H64 heart rate sensor. */
export const MAGENE_H64: DeviceProfile = {
  brand: 'Magene',
  model: 'H64',
  namePrefix: 'H64',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Magene H303 heart rate sensor. */
export const MAGENE_H303: DeviceProfile = {
  brand: 'Magene',
  model: 'H303',
  namePrefix: 'H303',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
