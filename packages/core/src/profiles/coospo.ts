import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/** Coospo H6 heart rate monitor. */
export const COOSPO_H6: DeviceProfile = {
  brand: 'Coospo',
  model: 'H6',
  namePrefix: 'CooSpo',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Coospo H808S heart rate monitor. */
export const COOSPO_H808S: DeviceProfile = {
  brand: 'Coospo',
  model: 'H808S',
  namePrefix: 'H808S',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
