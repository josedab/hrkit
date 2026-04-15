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
