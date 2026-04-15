// Types
export type {
  Capability,
  DeviceProfile,
  HRDevice,
  BLETransport,
  HRConnection,
  HRPacket,
  TimestampedHR,
  HRZoneConfig,
  ZoneDistribution,
  TRIMPConfig,
  DailyHRVReading,
  SessionConfig,
  Session,
  Round,
  RoundMeta,
  ReadableStream,
  Unsubscribe,
  ConnectOptions,
  ArtifactFilterOptions,
  ArtifactFilterResult,
} from './types.js';

// Constants
export {
  GATT_HR_SERVICE_UUID,
  GATT_HR_MEASUREMENT_UUID,
  POLAR_PMD_SERVICE_UUID,
  POLAR_PMD_CONTROL_UUID,
  POLAR_PMD_DATA_UUID,
} from './types.js';

// GATT parser
export { parseHeartRate } from './gatt-parser.js';

// Artifact filter
export { filterArtifacts } from './artifact-filter.js';

// HRV metrics
export { rmssd, sdnn, pnn50, meanHR, hrBaseline, readinessVerdict } from './hrv.js';

// Zones
export { hrToZone, zoneDistribution } from './zones.js';

// TRIMP
export { trimp, weeklyTRIMP } from './trimp.js';

// Session recorder
export { SessionRecorder } from './session-recorder.js';

// Connect
export { connectToDevice } from './connect.js';

// Mock transport
export { MockTransport } from './mock-transport.js';
export type { MockFixture } from './mock-transport.js';
