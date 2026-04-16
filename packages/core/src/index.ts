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
  ValidationError,
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
export { validateHRPacket, validateZoneConfig, validateSessionConfig, validateSession } from './validators.js';
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

// Observable stream utility
export { SimpleStream } from './stream.js';

// Plugin architecture
export { PluginRegistry } from './plugin.js';
export type { HRKitPlugin } from './plugin.js';

// Connect
export { connectToDevice } from './connect.js';

// Device profiles (re-exported for convenience)
export {
  GENERIC_HR,
  GARMIN_HRM_PRO,
  GARMIN_HRM_DUAL,
  GARMIN_HRM_RUN,
  WAHOO_TICKR,
  WAHOO_TICKR_X,
  WAHOO_TICKR_FIT,
  MAGENE_H64,
  MAGENE_H303,
  SUUNTO_SMART_SENSOR,
  COOSPO_H6,
  COOSPO_H808S,
} from './profiles/index.js';

// Workout protocol engine
export { WorkoutEngine, tabataProtocol, emomProtocol, pyramidProtocol, bjjRoundsProtocol, intervalProtocol } from './workout-protocol.js';
export type { WorkoutProtocol, WorkoutStep, StepTarget, WorkoutState, StepChangeEvent, TargetEvent } from './workout-protocol.js';

// Multi-device fusion
export { MultiDeviceManager } from './multi-device.js';
export type { DeviceQuality, FusionStrategyType, MultiDeviceConfig, FusedHRPacket } from './multi-device.js';

// Athlete longitudinal store
export { InMemoryAthleteStore } from './athlete-store.js';
export type { AthleteStore, SessionSummary, TrainingLoadPoint, HRVTrendPoint } from './athlete-store.js';

// Training insights
export { getTrainingRecommendation, assessACWRRisk, analyzeHRVTrend, calculateMonotony } from './training-insights.js';
export type { TrainingRecommendation, TrainingVerdict, RiskLevel, ZonePrescription, InsightReason, InsightInput } from './training-insights.js';

// Training insight constants
export { ACWR_CRITICAL, ACWR_HIGH, ACWR_UNDERTRAINED, MONOTONY_HIGH, TSB_DELOAD_THRESHOLD, HRV_POOR_RECOVERY, HRV_WELL_RECOVERED } from './training-insights.js';

// Group session
export { GroupSession } from './group-session.js';
export type { AthleteConfig, AthleteState, LeaderboardEntry, ZoneHeatmap, GroupStats, GroupSessionConfig } from './group-session.js';

// Mock transport
export { MockTransport } from './mock-transport.js';
export type { MockFixture } from './mock-transport.js';
