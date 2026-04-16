// Types

export type { SessionAnalysis } from './analyze.js';
// Session analysis
export { analyzeSession } from './analyze.js';
// Artifact filter
export { filterArtifacts } from './artifact-filter.js';
export type { AthleteStore, HRVTrendPoint, SessionSummary, TrainingLoadPoint } from './athlete-store.js';
// Athlete longitudinal store
export { InMemoryAthleteStore } from './athlete-store.js';
// Connect
export { connectToDevice } from './connect.js';
export type { ConnectionState, ManagedConnection, ReconnectConfig } from './connection.js';
// Connection management
export { connectWithReconnect, connectWithRetry } from './connection.js';
// Errors
export {
  ConnectionError,
  DeviceNotFoundError,
  HRKitError,
  ParseError,
  TimeoutError,
  ValidationError,
} from './errors.js';
// TCX export
export { sessionToTCX } from './export-tcx.js';
// GATT parser
export { parseHeartRate } from './gatt-parser.js';
export type {
  AthleteConfig,
  AthleteState,
  GroupSessionConfig,
  GroupStats,
  LeaderboardEntry,
  ZoneHeatmap,
} from './group-session.js';
// Group session
export { GroupSession } from './group-session.js';
// HRV metrics
export { hrBaseline, meanHR, pnn50, readinessVerdict, rmssd, sdnn } from './hrv.js';
export type { MockFixture } from './mock-transport.js';
// Mock transport
export { MockTransport } from './mock-transport.js';
export type { DeviceQuality, FusedHRPacket, FusionStrategyType, MultiDeviceConfig } from './multi-device.js';
// Multi-device fusion
export { MultiDeviceManager } from './multi-device.js';
export type { HRKitPlugin } from './plugin.js';
// Plugin architecture
export { PluginRegistry } from './plugin.js';
// Device profiles (re-exported for convenience)
export {
  COOSPO_H6,
  COOSPO_H808S,
  GARMIN_HRM_DUAL,
  GARMIN_HRM_PRO,
  GARMIN_HRM_RUN,
  GENERIC_HR,
  MAGENE_H64,
  MAGENE_H303,
  SUUNTO_SMART_SENSOR,
  WAHOO_TICKR,
  WAHOO_TICKR_FIT,
  WAHOO_TICKR_X,
} from './profiles/index.js';
export type { ArtifactEvent } from './realtime-artifacts.js';
// Real-time artifact detection
export { RealtimeArtifactDetector } from './realtime-artifacts.js';
// Session recorder
export { SessionRecorder } from './session-recorder.js';
// Session serialization
export { roundsToCSV, sessionFromJSON, sessionToCSV, sessionToJSON } from './session-serialization.js';
// Observable stream utility
export { SimpleStream } from './stream.js';
export type {
  InsightInput,
  InsightReason,
  RiskLevel,
  TrainingRecommendation,
  TrainingVerdict,
  ZonePrescription,
} from './training-insights.js';
// Training insights
// Training insight constants
export {
  ACWR_CRITICAL,
  ACWR_HIGH,
  ACWR_UNDERTRAINED,
  analyzeHRVTrend,
  assessACWRRisk,
  calculateMonotony,
  getTrainingRecommendation,
  HRV_POOR_RECOVERY,
  HRV_WELL_RECOVERED,
  MONOTONY_HIGH,
  TSB_DELOAD_THRESHOLD,
} from './training-insights.js';
// TRIMP
export { trimp, weeklyTRIMP } from './trimp.js';
export type {
  ArtifactFilterOptions,
  ArtifactFilterResult,
  BLETransport,
  Capability,
  ConnectOptions,
  DailyHRVReading,
  DeviceProfile,
  HRConnection,
  HRDevice,
  HRPacket,
  HRZoneConfig,
  ReadableStream,
  Round,
  RoundMeta,
  Session,
  SessionConfig,
  TimestampedHR,
  TRIMPConfig,
  Unsubscribe,
  ZoneDistribution,
} from './types.js';
// Constants
export {
  GATT_HR_MEASUREMENT_UUID,
  GATT_HR_SERVICE_UUID,
  POLAR_PMD_CONTROL_UUID,
  POLAR_PMD_DATA_UUID,
  POLAR_PMD_SERVICE_UUID,
  SESSION_SCHEMA_VERSION,
} from './types.js';
export type { ValidationConfig, ValidationResult } from './validators.js';
// Validators
export { validateHRPacket, validateSession, validateSessionConfig, validateZoneConfig } from './validators.js';
export type { CumulativeTRIMP, WindowedHRV } from './windowed-metrics.js';
// Windowed metrics
export { RollingRMSSD, TRIMPAccumulator } from './windowed-metrics.js';
export type {
  StepChangeEvent,
  StepTarget,
  TargetEvent,
  WorkoutProtocol,
  WorkoutState,
  WorkoutStep,
} from './workout-protocol.js';
// Workout protocol engine
export {
  bjjRoundsProtocol,
  emomProtocol,
  intervalProtocol,
  pyramidProtocol,
  tabataProtocol,
  WorkoutEngine,
} from './workout-protocol.js';
export type { AthleteProfile, ZonePreset } from './zone-presets.js';
// Zone presets & athlete profile
export { toSessionConfig, toTRIMPConfig, toZoneConfig, ZONE_PRESETS } from './zone-presets.js';
// Zones
export { hrToZone, zoneDistribution } from './zones.js';
