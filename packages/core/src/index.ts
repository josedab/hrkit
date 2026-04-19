export { SDK_NAME, SDK_VERSION } from './version.js';

// Types

// AFib screening
export type { AFibScreeningOptions, AFibScreeningResult, RhythmClassification } from './afib-screening.js';
export { poincareDescriptors, screenForAFib, shannonEntropyRR, turningPointRatio } from './afib-screening.js';
export type { SessionAnalysis } from './analyze.js';
// Session analysis
export { analyzeSession } from './analyze.js';
// Artifact filter
export { filterArtifacts } from './artifact-filter.js';
export type { AthleteStore, HRVTrendPoint, SessionSummary, TrainingLoadPoint } from './athlete-store.js';
// Athlete longitudinal store
export { InMemoryAthleteStore } from './athlete-store.js';
// Blood pressure estimation
export type { BPCalibration, BPEstimate, PTTInput } from './bp-estimation.js';
export { estimateBloodPressure, extractPTT } from './bp-estimation.js';
// HRV advanced
export type { CoherenceOptions, CoherenceResult } from './coherence.js';
export { bpmFromHz, coherenceScore } from './coherence.js';
// Conformance test rig
export type { ConformanceFixture, ConformanceResult, RecordedNotification } from './conformance.js';
export {
  bytesToHex,
  CONFORMANCE_FIXTURE_SCHEMA,
  hexToDataView,
  recordNotification,
  verifyFixture,
} from './conformance.js';
// Connect
export { connectToDevice } from './connect.js';
export type { ConnectionState, ManagedConnection, ReconnectConfig } from './connection.js';
// Connection management
export { connectWithReconnect, connectWithRetry } from './connection.js';
// Errors
export {
  AuthError,
  ConnectionError,
  DeviceNotFoundError,
  formatError,
  HRKitError,
  isRetryable,
  ParseError,
  RateLimitError,
  RequestError,
  ServerError,
  TimeoutError,
  ValidationError,
} from './errors.js';
// TCX export
export { sessionToTCX } from './export-tcx.js';
export type { FusedSample, GlucoseReading, GlucoseSource } from './fusion.js';
export {
  encodeRequestControl,
  encodeReset,
  encodeSetIndoorBikeSimulation,
  encodeSetTargetPower,
  FTMS_OPCODE,
  fuseStreams,
  MemoryGlucoseSource,
} from './fusion.js';
// GATT parser
export { parseHeartRate } from './gatt-parser.js';
export type {
  AthleteConfig,
  AthleteState,
  GroupSessionConfig,
  GroupSnapshot,
  GroupStats,
  LeaderboardEntry,
  ZoneComplianceAlert,
  ZoneHeatmap,
} from './group-session.js';
// Group session
export { GroupSession } from './group-session.js';
// HRV metrics
export { hrBaseline, meanHR, pnn50, readinessVerdict, rmssd, sdnn } from './hrv.js';
export type { CleanedRR, FrequencyDomainResult, HRVReport, PoincareResult } from './hrv-advanced.js';
export { cleanRR, dfaAlpha1, frequencyDomain, hrvReport, poincare } from './hrv-advanced.js';
export type { Logger, LogLevel } from './logger.js';
export {
  ConsoleLogger,
  getLogger,
  NoopLogger,
  REDACTED,
  redact,
  setLogger,
} from './logger.js';
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
  DEXCOM_SHARE_CGM,
  GARMIN_HRM_DUAL,
  GARMIN_HRM_PRO,
  GARMIN_HRM_RUN,
  GATT_FTMS_SERVICE_UUID,
  GATT_GLUCOSE_SERVICE_UUID,
  GENERIC_FTMS_TRAINER,
  GENERIC_GLUCOSE_METER,
  GENERIC_HR,
  LIBRE_LINKUP_CGM,
  MAGENE_H64,
  MAGENE_H303,
  SARIS_H3,
  SUUNTO_SMART_SENSOR,
  TACX_NEO,
  WAHOO_KICKR,
  WAHOO_TICKR,
  WAHOO_TICKR_FIT,
  WAHOO_TICKR_X,
} from './profiles/index.js';
export type { ArtifactEvent } from './realtime-artifacts.js';
// Real-time artifact detection
export { RealtimeArtifactDetector } from './realtime-artifacts.js';
export type { RetryOptions } from './retry.js';
export { retry, sleep, timeout } from './retry.js';
// Multi-sensor capability v2: normalized sensor event bus
export type { SensorEvent, SensorEventKind, SensorEventOf } from './sensor-bus.js';
export { SensorBus } from './sensor-bus.js';
// Multi-sensor fusion
export type { FusedOutput, FusionConfig, SensorReading, SensorSource } from './sensor-fusion.js';
export { SensorFusion } from './sensor-fusion.js';
// Sensor profiles & parsers (cycling power, CSC, RSC, SpO2)
export type { CSCPacket, CyclingPowerPacket, RSCPacket, SpO2Packet } from './sensors.js';
export {
  CYCLING_CSC_PROFILE,
  CYCLING_POWER_PROFILE,
  computeCadenceRPM,
  PULSE_OX_PROFILE,
  parseCSC,
  parseCyclingPower,
  parsePulseOxContinuous,
  parseRSC,
  RUNNING_RSC_PROFILE,
  sFloat16,
} from './sensors.js';
export type { SessionMigrator } from './session-migrations.js';
export {
  BUILTIN_MIGRATORS,
  isCurrentSchema,
  migrateSession,
  SESSION_JSON_SCHEMA,
} from './session-migrations.js';
// Session recorder
export type { RecorderState } from './session-recorder.js';
// Session recorder
export { SessionRecorder } from './session-recorder.js';
// Session replay & annotations
export type { Annotation, ReplayEvent, ReplayState } from './session-replay.js';
export { SessionPlayer } from './session-replay.js';
// Session serialization
export type { SessionFromJSONOptions } from './session-serialization.js';
export { roundsToCSV, sessionFromJSON, sessionToCSV, sessionToJSON } from './session-serialization.js';
// Observable stream utility
export { SimpleStream } from './stream.js';
// Stress & recovery scoring
export type { StressInput, StressResult, StressWeights } from './stress.js';
export { computeStress, estimateBreathingRate } from './stress.js';
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
// Training plan protocol
export type { PlanProgress, TrainingBlock, TrainingDay, TrainingPlan, TrainingWeek } from './training-plan.js';
export { createWeeklyPlan, PlanRunner } from './training-plan.js';
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
// Validation utilities (Bland-Altman, MAPE)
export {
  type BlandAltmanResult,
  blandAltman,
  DEFAULT_HR_THRESHOLDS,
  DEFAULT_RMSSD_THRESHOLDS,
  type MAPEResult,
  mape,
  type ValidationReport,
  type ValidationThresholds,
  validateAgainstReference,
} from './validation.js';
export type { ValidationConfig, ValidationResult } from './validators.js';
// Validators
export { validateHRPacket, validateSession, validateSessionConfig, validateZoneConfig } from './validators.js';
// VO2max estimation & fitness scoring
export type { FitnessScore, VO2maxEstimate, VO2maxSessionInput } from './vo2max.js';
export { estimateVO2maxCooper, estimateVO2maxFromSession, estimateVO2maxUth, fitnessScore } from './vo2max.js';
export type { CumulativeTRIMP, WindowedHRV } from './windowed-metrics.js';
// Windowed metrics
export { RollingRMSSD, TRIMPAccumulator } from './windowed-metrics.js';
// Workout DSL + cues + protocol library
export type { SpeakLike, UtteranceCtor } from './workout-dsl.js';
export {
  BJJ_ROUNDS,
  createBrowserCues,
  MAF_45,
  NORWEGIAN_4X4,
  PROTOCOL_LIBRARY,
  parseDuration,
  parseWorkoutDSL,
  TABATA,
  WorkoutCues,
  workoutToDSL,
} from './workout-dsl.js';
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
