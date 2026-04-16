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
  SESSION_SCHEMA_VERSION,
} from './types.js';

// Errors
export {
  HRKitError,
  ParseError,
  ConnectionError,
  TimeoutError,
  DeviceNotFoundError,
} from './errors.js';

// GATT parser
export { parseHeartRate } from './gatt-parser.js';

// Artifact filter
export { filterArtifacts } from './artifact-filter.js';

// HRV metrics
export { rmssd, sdnn, pnn50, meanHR, hrBaseline, readinessVerdict } from './hrv.js';

// Zones
export { hrToZone, zoneDistribution } from './zones.js';

// Zone presets & athlete profile
export { ZONE_PRESETS, toSessionConfig, toZoneConfig, toTRIMPConfig } from './zone-presets.js';
export type { ZonePreset, AthleteProfile } from './zone-presets.js';

// TRIMP
export { trimp, weeklyTRIMP } from './trimp.js';

// Session recorder
export { SessionRecorder } from './session-recorder.js';

// Session serialization
export { sessionToJSON, sessionFromJSON, sessionToCSV, roundsToCSV } from './session-serialization.js';

// Session analysis
export { analyzeSession } from './analyze.js';
export type { SessionAnalysis } from './analyze.js';

// TCX export
export { sessionToTCX } from './export-tcx.js';

// Validators
export { validateHRPacket } from './validators.js';
export type { ValidationResult, ValidationConfig } from './validators.js';

// Connection management
export { connectWithRetry, connectWithReconnect } from './connection.js';
export type { ConnectionState, ManagedConnection, ReconnectConfig } from './connection.js';

// Windowed metrics
export { RollingRMSSD, TRIMPAccumulator } from './windowed-metrics.js';
export type { WindowedHRV, CumulativeTRIMP } from './windowed-metrics.js';

// Real-time artifact detection
export { RealtimeArtifactDetector } from './realtime-artifacts.js';
export type { ArtifactEvent } from './realtime-artifacts.js';

// Connect
export { connectToDevice } from './connect.js';

// Device profiles (re-exported for convenience)
export { GENERIC_HR } from './profiles/index.js';

// Mock transport
export { MockTransport } from './mock-transport.js';
export type { MockFixture } from './mock-transport.js';
