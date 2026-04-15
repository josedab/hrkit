// ── Capability & Device Profiles ─────────────────────────────────────────

export type Capability = 'heartRate' | 'rrIntervals' | 'ecg' | 'accelerometer';

export interface DeviceProfile {
  brand: string;
  model: string;
  namePrefix: string;
  capabilities: Capability[];
  serviceUUIDs: string[];
}

// ── BLE GATT UUIDs ──────────────────────────────────────────────────────

export const GATT_HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
export const GATT_HR_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
export const POLAR_PMD_SERVICE_UUID = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const POLAR_PMD_CONTROL_UUID = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const POLAR_PMD_DATA_UUID = 'fb005c82-02e7-f387-1cad-8acd2d8df0c8';

// ── HR Packets ──────────────────────────────────────────────────────────

export interface HRPacket {
  timestamp: number;
  hr: number;
  rrIntervals: number[];
  contactDetected: boolean;
  energyExpended?: number;
}

export interface TimestampedHR {
  timestamp: number;
  hr: number;
}

// ── BLE Transport ───────────────────────────────────────────────────────

export interface HRDevice {
  id: string;
  name: string;
  rssi: number;
  profile?: DeviceProfile;
}

export interface BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}

export interface HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;

  heartRate(): AsyncIterable<HRPacket>;
  disconnect(): Promise<void>;
  readonly onDisconnect: Promise<void>;
}

// ── Zone Config ─────────────────────────────────────────────────────────

export interface HRZoneConfig {
  maxHR: number;
  restHR?: number;
  zones: [number, number, number, number]; // 4 thresholds → 5 zones
}

export interface ZoneDistribution {
  zones: Record<1 | 2 | 3 | 4 | 5, number>; // seconds in each zone
  total: number;
}

// ── TRIMP ───────────────────────────────────────────────────────────────

export interface TRIMPConfig {
  maxHR: number;
  restHR: number;
  sex: 'male' | 'female' | 'neutral';
}

// ── HRV ─────────────────────────────────────────────────────────────────

export interface DailyHRVReading {
  date: string; // ISO date YYYY-MM-DD
  rmssd: number;
}

// ── Session ─────────────────────────────────────────────────────────────

export interface SessionConfig {
  maxHR: number;
  restHR?: number;
  zones?: [number, number, number, number];
}

export interface RoundMeta {
  label?: string;
  [key: string]: unknown;
}

export interface Round {
  index: number;
  startTime: number;
  endTime: number;
  samples: TimestampedHR[];
  rrIntervals: number[];
  meta?: RoundMeta;
}

export interface Session {
  startTime: number;
  endTime: number;
  samples: TimestampedHR[];
  rrIntervals: number[];
  rounds: Round[];
  config: SessionConfig;
}

// ── Observable ──────────────────────────────────────────────────────────

export type Unsubscribe = () => void;

export interface ReadableStream<T> {
  subscribe(listener: (value: T) => void): Unsubscribe;
  get(): T | undefined;
}

// ── Connect Options ─────────────────────────────────────────────────────

export interface ConnectOptions {
  prefer?: DeviceProfile[];
  fallback?: DeviceProfile;
  timeoutMs?: number;
}

// ── Artifact Filter ─────────────────────────────────────────────────────

export interface ArtifactFilterOptions {
  threshold?: number;
  strategy?: 'remove' | 'interpolate';
  windowSize?: number;
}

export interface ArtifactFilterResult {
  filtered: number[];
  artifactRate: number;
}
