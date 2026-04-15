// ── Capability & Device Profiles ─────────────────────────────────────────

/** Capabilities a BLE HR device may support. */
export type Capability = 'heartRate' | 'rrIntervals' | 'ecg' | 'accelerometer';

/**
 * Describes a BLE heart rate device's identity and capabilities.
 * Used for scan filtering and capability gating. Consumer code
 * requests capabilities, not specific devices.
 */
export interface DeviceProfile {
  brand: string;
  model: string;
  /** BLE advertised name prefix used for scan matching. Empty string matches any device. */
  namePrefix: string;
  capabilities: Capability[];
  /** BLE service UUIDs to filter during scan. */
  serviceUUIDs: string[];
}

// ── BLE GATT UUIDs ──────────────────────────────────────────────────────

export const GATT_HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const GATT_HR_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
export const POLAR_PMD_SERVICE_UUID = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const POLAR_PMD_CONTROL_UUID = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const POLAR_PMD_DATA_UUID = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8';

// ── HR Packets ──────────────────────────────────────────────────────────

/**
 * Parsed BLE Heart Rate Measurement characteristic (0x2A37).
 * Produced by `parseHeartRate()` from raw GATT notification data.
 */
export interface HRPacket {
  timestamp: number;
  /** Heart rate in beats per minute. */
  hr: number;
  /** RR intervals in milliseconds (converted from BLE 1/1024s units). */
  rrIntervals: number[];
  /** Whether skin contact is detected. `true` if sensor doesn't support contact detection. */
  contactDetected: boolean;
  /** Cumulative energy expended in kJ, if reported by the device. */
  energyExpended?: number;
}

/** A timestamped heart rate sample (subset of HRPacket for metric functions). */
export interface TimestampedHR {
  timestamp: number;
  hr: number;
}

// ── BLE Transport ───────────────────────────────────────────────────────

/** A discovered BLE heart rate device. */
export interface HRDevice {
  id: string;
  name: string;
  /** Signal strength in dBm. May be 0 on platforms that don't expose RSSI. */
  rssi: number;
  /** Matched profile, if a scan filter was used. */
  profile?: DeviceProfile;
}

/**
 * Platform-agnostic BLE transport interface.
 * Implement this for your target platform (React Native, Web, Node, etc.).
 */
export interface BLETransport {
  /** Scan for BLE HR devices. Optionally filter by profiles. Returns an async iterable. */
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  /** Stop an active scan. */
  stopScan(): Promise<void>;
  /** Connect to a device by ID using the given profile. */
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}

/**
 * An active connection to a BLE HR device.
 * Provides a heart rate data stream and disconnect management.
 */
export interface HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;

  /** Stream of HR packets from the GATT Heart Rate Measurement characteristic. */
  heartRate(): AsyncIterable<HRPacket>;
  /** Disconnect from the device. */
  disconnect(): Promise<void>;
  /** Resolves when the device disconnects (explicitly or due to connection loss). */
  readonly onDisconnect: Promise<void>;
}

// ── Zone Config ─────────────────────────────────────────────────────────

/**
 * Configuration for the 5-zone HR model.
 * Thresholds are percentages of maxHR (e.g., `[0.6, 0.7, 0.8, 0.9]`).
 */
export interface HRZoneConfig {
  maxHR: number;
  restHR?: number;
  /** 4 thresholds that define boundaries between 5 zones. */
  zones: [number, number, number, number];
}

/** Time spent in each HR zone. */
export interface ZoneDistribution {
  /** Seconds spent in each zone (1–5). */
  zones: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Total duration in seconds (excluding gaps > 30s). */
  total: number;
}

// ── TRIMP ───────────────────────────────────────────────────────────────

/**
 * Configuration for Bannister's TRIMP (Training Impulse) calculation.
 * Sex factors: male=1.92, female=1.67, neutral=1.80.
 */
export interface TRIMPConfig {
  maxHR: number;
  restHR: number;
  sex: 'male' | 'female' | 'neutral';
}

// ── HRV ─────────────────────────────────────────────────────────────────

/** A daily HRV reading for baseline tracking. */
export interface DailyHRVReading {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Morning rMSSD value in milliseconds. */
  rmssd: number;
}

// ── Session ─────────────────────────────────────────────────────────────

/** Configuration for a recording session. */
export interface SessionConfig {
  maxHR: number;
  restHR?: number;
  /** Zone thresholds. Defaults to `[0.6, 0.7, 0.8, 0.9]` if omitted. */
  zones?: [number, number, number, number];
}

/** Metadata for a round (e.g., label, custom key-value pairs). */
export interface RoundMeta {
  label?: string;
  [key: string]: unknown;
}

/** A single round within a session (e.g., one BJJ sparring round). */
export interface Round {
  /** Zero-based round index within the session. */
  index: number;
  startTime: number;
  endTime: number;
  samples: TimestampedHR[];
  rrIntervals: number[];
  meta?: RoundMeta;
}

/** A completed recording session with all samples, RR intervals, and rounds. */
export interface Session {
  startTime: number;
  endTime: number;
  samples: TimestampedHR[];
  rrIntervals: number[];
  rounds: Round[];
  config: SessionConfig;
}

// ── Observable ──────────────────────────────────────────────────────────

/** Callback to unsubscribe from a stream. */
export type Unsubscribe = () => void;

/**
 * Minimal observable stream interface with BehaviorSubject-like semantics.
 * New subscribers receive the current value immediately.
 */
export interface ReadableStream<T> {
  /** Subscribe to value changes. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): Unsubscribe;
  /** Get the current value, or `undefined` if no value has been emitted. */
  get(): T | undefined;
}

// ── Connect Options ─────────────────────────────────────────────────────

/** Options for `connectToDevice()`. */
export interface ConnectOptions {
  /** Preferred device profiles, tried in order. */
  prefer?: DeviceProfile[];
  /** Fallback profile if no preferred match is found. */
  fallback?: DeviceProfile;
  /** Scan timeout in milliseconds (default: 10000). */
  timeoutMs?: number;
}

// ── Artifact Filter ─────────────────────────────────────────────────────

/** Options for `filterArtifacts()`. */
export interface ArtifactFilterOptions {
  /** Deviation threshold from local mean (default: 0.2 = 20%). */
  threshold?: number;
  /** `'remove'` discards artifacts, `'interpolate'` replaces with interpolated values. */
  strategy?: 'remove' | 'interpolate';
  /** Sliding window size in beats (default: 5). */
  windowSize?: number;
}

/** Result of artifact filtering. */
export interface ArtifactFilterResult {
  /** Clean RR intervals after artifact handling. */
  filtered: number[];
  /** Proportion of original intervals flagged as artifacts (0–1). */
  artifactRate: number;
}
