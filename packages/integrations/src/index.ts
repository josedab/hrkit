export { type FitEncodeOptions, sessionToFIT, verifyFIT } from './fit.js';
export {
  type HealthRecord,
  type HealthStore,
  type HrSampleRecord,
  MemoryHealthStore,
  type SessionToRecordsOptions,
  sessionToHealthRecords,
  type WorkoutRecord,
} from './health.js';
export {
  type FetchLike,
  GarminUploader,
  HRKIT_USER_AGENT,
  IntervalsIcuUploader,
  parseRetryAfter,
  type RetryPolicy,
  type SessionUploader,
  StravaUploader,
  staticTokenProvider,
  summarizeUploads,
  type TokenProvider,
  TrainingPeaksUploader,
  type UploadOptions,
  type UploadResult,
  type UploadSummary,
  uploadToAll,
  withAuth,
  withRetry,
  withUserAgent,
} from './providers/index.js';
export { sessionToTCX, type TcxOptions } from './tcx.js';
export { SDK_NAME, SDK_VERSION } from './version.js';
