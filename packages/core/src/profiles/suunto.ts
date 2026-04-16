import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID } from '../types.js';

/** Suunto Smart Sensor heart rate belt. */
export const SUUNTO_SMART_SENSOR: DeviceProfile = {
  brand: 'Suunto',
  model: 'Smart Sensor',
  namePrefix: 'Suunto',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
