---
sidebar_position: 1
title: Core API Reference
description: Complete API reference for @hrkit/core — all exports, functions, types, and constants.
---

# @hrkit/core API Reference

## GATT Parser

### `parseHeartRate(data, timestamp?)`

Parse a BLE Heart Rate Measurement characteristic (0x2A37).

```typescript
function parseHeartRate(data: DataView, timestamp?: number): HRPacket;
```

**Parameters:**
- `data` — Raw BLE characteristic value as a `DataView`
- `timestamp` — Optional timestamp in milliseconds (defaults to `Date.now()`)

**Returns:** `HRPacket`

```typescript
interface HRPacket {
  timestamp: number;          // milliseconds
  hr: number;                 // beats per minute
  rrIntervals: number[];      // milliseconds (converted from 1/1024s)
  contactDetected: boolean;   // skin contact status
  energyExpended?: number;    // cumulative kilojoules
}
```

:::info
RR intervals are converted from the BLE-standard 1/1024s units to milliseconds using `raw × 1000/1024`.
:::

---

## HRV Metrics

### `rmssd(rr)`

Root Mean Square of Successive Differences. Primary parasympathetic HRV metric.

```typescript
function rmssd(rr: number[]): number;
```

### `sdnn(rr)`

Standard Deviation of NN intervals. Overall HRV.

```typescript
function sdnn(rr: number[]): number;
```

### `pnn50(rr)`

Percentage of successive RR differences greater than 50ms.

```typescript
function pnn50(rr: number[]): number;
```

### `meanHR(rr)`

Mean heart rate calculated from RR intervals (`60000 / mean RR`).

```typescript
function meanHR(rr: number[]): number;
```

### `hrBaseline(readings, windowDays)`

Median RMSSD from a rolling window of daily readings.

```typescript
function hrBaseline(readings: DailyHRVReading[], windowDays: number): number | null;

interface DailyHRVReading {
  date: string;    // ISO date string
  rmssd: number;   // daily RMSSD value
}
```

Returns `null` if no readings are available.

### `readinessVerdict(todayRmssd, baseline)`

Training readiness based on today's RMSSD vs baseline.

```typescript
function readinessVerdict(todayRmssd: number, baseline: number): 'go_hard' | 'moderate' | 'rest';
```

| Return value | Condition |
|-------------|-----------|
| `'go_hard'` | today ≥ 95% of baseline |
| `'moderate'` | today 80–95% of baseline |
| `'rest'` | today < 80% of baseline |

---

## Zones

### `hrToZone(hr, config)`

Map a heart rate value to zone 1–5.

```typescript
function hrToZone(hr: number, config: HRZoneConfig): 1 | 2 | 3 | 4 | 5;

interface HRZoneConfig {
  maxHR: number;
  restHR?: number;
  zones: [number, number, number, number]; // 4 thresholds → 5 zones
}
```

### `zoneDistribution(samples, config)`

Time-in-zone distribution from timestamped HR samples. Skips gaps > 30 seconds.

```typescript
function zoneDistribution(samples: TimestampedHR[], config: HRZoneConfig): ZoneDistribution;

interface TimestampedHR {
  timestamp: number;
  hr: number;
}
```

---

## TRIMP

### `trimp(samples, config)`

Bannister Training Impulse. Skips gaps > 30 seconds.

```typescript
function trimp(samples: TimestampedHR[], config: TRIMPConfig): number;

interface TRIMPConfig {
  maxHR: number;
  restHR: number;
  sex: 'male' | 'female' | 'neutral';
}
```

Sex factors: male = 1.92, female = 1.67, neutral = 1.80.

### `weeklyTRIMP(sessions, weekStart)`

Aggregate TRIMP across sessions within a 7-day window.

```typescript
function weeklyTRIMP(sessions: Session[], weekStart: Date): number;
```

---

## Artifact Filter

### `filterArtifacts(rr, options?)`

Filter artifact RR intervals using a sliding window approach.

```typescript
function filterArtifacts(
  rr: number[],
  options?: {
    threshold?: number;    // default: 0.2 (20%)
    strategy?: 'remove' | 'interpolate';  // default: 'remove'
    windowSize?: number;   // default: 5
  }
): { filtered: number[]; artifactRate: number };
```

---

## SessionRecorder

### Constructor

```typescript
new SessionRecorder(config: SessionConfig);

interface SessionConfig {
  maxHR: number;
  restHR?: number;
  sex?: 'male' | 'female' | 'neutral';
  zones?: [number, number, number, number]; // default: [0.6, 0.7, 0.8, 0.9]
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `ingest(packet)` | `void` | Feed an `HRPacket` into the session |
| `startRound(meta?)` | `void` | Begin a new round with optional metadata |
| `endRound(meta?)` | `Round` | End the current round. Throws if none in progress |
| `currentHR()` | `number \| null` | Latest ingested heart rate |
| `currentZone()` | `1–5 \| null` | Latest computed zone |
| `elapsedSeconds()` | `number` | Seconds since first ingested packet |
| `end()` | `Session` | Finalize session with all data |

### Observables

| Property | Type | Description |
|----------|------|-------------|
| `hr$` | `Observable<number>` | Real-time HR stream. Emits current value on subscribe. |
| `zone$` | `Observable<1\|2\|3\|4\|5>` | Real-time zone stream. Emits current value on subscribe. |

---

## Connection

### `connectToDevice(transport, options?)`

Scan and connect to the best matching device.

```typescript
function connectToDevice(
  transport: BLETransport,
  options?: {
    prefer?: DeviceProfile[];
    fallback?: DeviceProfile;
    timeoutMs?: number;  // default: 10000
  }
): Promise<HRConnection>;
```

---

## Types

### `BLETransport`

```typescript
interface BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

### `HRConnection`

```typescript
interface HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;
  heartRate(): AsyncIterable<HRPacket>;
  disconnect(): Promise<void>;
  readonly onDisconnect: Promise<void>;
}
```

### `HRDevice`

```typescript
interface HRDevice {
  id: string;
  name: string;
  rssi: number;
  profile?: DeviceProfile;
}
```

### `DeviceProfile`

```typescript
interface DeviceProfile {
  brand: string;
  model: string;
  namePrefix: string;
  capabilities: Capability[];
  serviceUUIDs: string[];
}

type Capability = 'heartRate' | 'rrIntervals' | 'ecg' | 'accelerometer';
```

---

## Constants

| Constant | Value |
|----------|-------|
| `GATT_HR_SERVICE_UUID` | `0000180d-0000-1000-8000-00805f9b34fb` |
| `GATT_HR_MEASUREMENT_UUID` | `00002a37-0000-1000-8000-00805f9b34fb` |
| `POLAR_PMD_SERVICE_UUID` | `fb005c80-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_CONTROL_UUID` | `fb005c81-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_DATA_UUID` | `fb005c82-02e7-f387-1cad-8acd2d8df0c8` |

---

## Profiles Sub-Export

```typescript
import { GENERIC_HR } from '@hrkit/core/profiles';
```

`GENERIC_HR` matches any BLE device advertising the standard Heart Rate service.
