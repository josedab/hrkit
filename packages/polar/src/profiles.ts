import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID } from '@hrkit/core';

/** Polar H10 chest strap. Supports HR, RR, ECG, and accelerometer. */
export const POLAR_H10: DeviceProfile = {
  brand: 'Polar',
  model: 'H10',
  namePrefix: 'Polar H10',
  capabilities: ['heartRate', 'rrIntervals', 'ecg', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

/** Polar H9 chest strap. Supports HR, RR, and ECG (no accelerometer). */
export const POLAR_H9: DeviceProfile = {
  brand: 'Polar',
  model: 'H9',
  namePrefix: 'Polar H9',
  capabilities: ['heartRate', 'rrIntervals', 'ecg'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

/** Polar OH1 optical sensor. Supports HR, RR, and accelerometer (no ECG). */
export const POLAR_OH1: DeviceProfile = {
  brand: 'Polar',
  model: 'OH1',
  namePrefix: 'Polar OH1',
  capabilities: ['heartRate', 'rrIntervals', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

/** Polar Verity Sense optical sensor. Supports HR, RR, and accelerometer (no ECG). */
export const POLAR_VERITY_SENSE: DeviceProfile = {
  brand: 'Polar',
  model: 'Verity Sense',
  namePrefix: 'Polar Sense',
  capabilities: ['heartRate', 'rrIntervals', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};
