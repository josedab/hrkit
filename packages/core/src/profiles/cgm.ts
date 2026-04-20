import type { DeviceProfile } from '../types.js';

/** BLE GATT Glucose Service (0x1808). */
export const GATT_GLUCOSE_SERVICE_UUID = '00001808-0000-1000-8000-00805f9b34fb';

/**
 * Generic BLE GATT 0x1808 glucose meter. Spot-check meters; not a CGM.
 * CGMs (Dexcom G7, Libre 3) typically use vendor-cloud APIs rather than
 * standard GATT — see `@hrkit/integrations` for those bridges.
 */
export const GENERIC_GLUCOSE_METER: DeviceProfile = {
  brand: 'Generic',
  model: 'BLE Glucose Meter',
  namePrefix: '',
  capabilities: ['glucose'],
  serviceUUIDs: [GATT_GLUCOSE_SERVICE_UUID],
};

/**
 * Marker profile for vendor-cloud CGMs (Dexcom Share, Libre LinkUp). These
 * never appear in BLE scans — the profile exists so capability queries and UI
 * can treat them uniformly with hardware sensors.
 */
export const DEXCOM_SHARE_CGM: DeviceProfile = {
  brand: 'Dexcom',
  model: 'Share (cloud)',
  namePrefix: '',
  capabilities: ['glucose'],
  serviceUUIDs: [],
};

/** Same for Libre LinkUp. */
export const LIBRE_LINKUP_CGM: DeviceProfile = {
  brand: 'Abbott',
  model: 'Libre LinkUp (cloud)',
  namePrefix: '',
  capabilities: ['glucose'],
  serviceUUIDs: [],
};
