import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

export const GENERIC_HR: DeviceProfile = {
  brand: 'Generic',
  model: 'BLE HR sensor',
  namePrefix: '',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
