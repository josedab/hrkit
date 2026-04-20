import type { DeviceProfile } from '../types.js';

/** FTMS Fitness Machine Service UUID (0x1826). */
export const GATT_FTMS_SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';

/** Wahoo Kickr smart trainer (FTMS-compatible). */
export const WAHOO_KICKR: DeviceProfile = {
  brand: 'Wahoo',
  model: 'Kickr',
  namePrefix: 'KICKR',
  capabilities: ['smartTrainer', 'cyclingPower', 'cyclingSpeedCadence'],
  serviceUUIDs: [GATT_FTMS_SERVICE_UUID],
};

/** Tacx Neo / Flux smart trainer (FTMS). */
export const TACX_NEO: DeviceProfile = {
  brand: 'Tacx',
  model: 'Neo',
  namePrefix: 'Tacx',
  capabilities: ['smartTrainer', 'cyclingPower', 'cyclingSpeedCadence'],
  serviceUUIDs: [GATT_FTMS_SERVICE_UUID],
};

/** Saris H3 / M2 smart trainer (FTMS). */
export const SARIS_H3: DeviceProfile = {
  brand: 'Saris',
  model: 'H3',
  namePrefix: 'Saris',
  capabilities: ['smartTrainer', 'cyclingPower'],
  serviceUUIDs: [GATT_FTMS_SERVICE_UUID],
};

/** Generic FTMS-compatible smart trainer. */
export const GENERIC_FTMS_TRAINER: DeviceProfile = {
  brand: 'Generic',
  model: 'FTMS Trainer',
  namePrefix: '',
  capabilities: ['smartTrainer'],
  serviceUUIDs: [GATT_FTMS_SERVICE_UUID],
};
