// Types
export type { PolarConnection, ECGPacket, ACCPacket, ACCSample } from './types.js';

// Profiles
export { POLAR_H10, POLAR_H9, POLAR_OH1, POLAR_VERITY_SENSE } from './profiles.js';

// Guards
export { isPolarConnection } from './guards.js';

// PMD protocol
export {
  buildStartECGCommand,
  buildStartACCCommand,
  buildStopECGCommand,
  buildStopACCCommand,
  buildGetSettingsCommand,
  buildStopCommand,
  parseECGData,
  parseACCData,
  parsePMDControlResponse,
  PMD_MEASUREMENT_ECG,
  PMD_MEASUREMENT_ACC,
} from './pmd.js';
export type { PMDControlResponse } from './pmd.js';
