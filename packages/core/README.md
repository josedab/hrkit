# @hrkit/core

Zero-dependency TypeScript library for BLE heart rate sensor data processing. Platform-agnostic — works on any runtime that can provide BLE data.

## Install

```bash
npm install @hrkit/core
# or
pnpm add @hrkit/core
```

## Features

- **GATT HR Parser** — Parse BLE Heart Rate Measurement characteristic (0x2A37)
- **HRV Metrics** — RMSSD, SDNN, pNN50, mean HR, baseline tracking, readiness verdict
- **Zone Calculator** — 5-zone HR mapping with time-in-zone distribution
- **TRIMP** — Bannister training impulse with sex-based weighting
- **Artifact Filter** — RR interval artifact detection with remove or interpolate strategies
- **Session Recorder** — Stateful session recording with round tracking and observable streams
- **Device Profiles** — Capability-based device abstraction
- **MockTransport** — In-memory BLE transport for testing

## Usage

### Pure Metric Functions

All metric functions are pure — no classes, no state, no side effects:

```typescript
import { rmssd, sdnn, pnn50, meanHR, hrToZone, trimp, filterArtifacts } from '@hrkit/core';

// HRV from RR intervals (milliseconds)
const intervals = [800, 810, 790, 820, 805];
rmssd(intervals);       // ~14.2 ms — parasympathetic activity
sdnn(intervals);        // ~9.4 ms  — overall variability
pnn50(intervals);       // 0%       — successive diffs > 50ms
meanHR(intervals);      // ~74.2 bpm

// Artifact filtering before HRV analysis
const { filtered, artifactRate } = filterArtifacts(intervals, {
  threshold: 0.2,         // flag values >20% from local mean (default)
  strategy: 'remove',     // or 'interpolate'
  windowSize: 5,          // sliding window beats (default)
});

// HR zones (5-zone model)
const zoneConfig = { maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number] };
hrToZone(162, zoneConfig);  // → 4 (80–90% maxHR)

// TRIMP (Training Impulse)
const samples = [{ timestamp: 0, hr: 150 }, { timestamp: 60000, hr: 155 }];
trimp(samples, { maxHR: 185, restHR: 48, sex: 'male' });
```

### Readiness Check

```typescript
import { hrBaseline, readinessVerdict } from '@hrkit/core';

const readings = [
  { date: '2024-01-08', rmssd: 62 },
  { date: '2024-01-09', rmssd: 58 },
  { date: '2024-01-10', rmssd: 65 },
  // ...7 days
];

const baseline = hrBaseline(readings, 7);  // median rMSSD over 7-day window
const verdict = readinessVerdict(58, baseline!);
// 'go_hard' (≥95% baseline), 'moderate' (80–95%), or 'rest' (<80%)
```

### Session Recording

```typescript
import { SessionRecorder, connectToDevice, MockTransport } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

// Real-time observables (BehaviorSubject-like: emit current value on subscribe)
recorder.hr$.subscribe((hr) => console.log('HR:', hr));
recorder.zone$.subscribe((zone) => console.log('Zone:', zone));

// Ingest packets from a BLE connection
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// Round tracking for interval training
recorder.startRound({ label: 'Round 1' });
// ... ingest packets ...
const round = recorder.endRound();

// End session and get full dataset
const session = recorder.end();
// session.samples, session.rrIntervals, session.rounds, session.config
```

### Custom Device Profiles

Any developer can define profiles for unsupported devices:

```typescript
import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';

const WAHOO_TICKR: DeviceProfile = {
  brand: 'Wahoo',
  model: 'TICKR',
  namePrefix: 'TICKR',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

const conn = await connectToDevice(transport, { prefer: [WAHOO_TICKR] });
```

### BLETransport

The BLE transport is an interface — implement it for any platform:

```typescript
interface BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

Built-in implementations:
- `MockTransport` (this package) — replay in-memory fixture data
- [`ReactNativeTransport`](../react-native/) — `react-native-ble-plx`
- [`WebBluetoothTransport`](../web/) — Web Bluetooth API

## API Reference

### GATT Parser

| Function | Description |
|----------|-------------|
| `parseHeartRate(data, timestamp?)` | Parse a BLE HR Measurement characteristic (0x2A37). Returns `HRPacket`. |

> **Note:** RR intervals in BLE are transmitted in 1/1024s units. The parser converts to milliseconds using `raw × 1000/1024` (not `raw × 1`).

### HRV Metrics

| Function | Description |
|----------|-------------|
| `rmssd(rr)` | Root Mean Square of Successive Differences. Primary parasympathetic HRV metric. |
| `sdnn(rr)` | Standard Deviation of NN intervals. Overall HRV. |
| `pnn50(rr)` | Percentage of successive diffs > 50ms. Parasympathetic marker. |
| `meanHR(rr)` | Mean heart rate from RR intervals (60000 / mean RR). |
| `hrBaseline(readings, windowDays)` | Median rMSSD from a rolling window of daily readings. Returns `null` if no data. |
| `readinessVerdict(todayRmssd, baseline)` | Training readiness: `'go_hard'` (≥95%), `'moderate'` (80–95%), `'rest'` (<80%). |

### Zones

| Function | Description |
|----------|-------------|
| `hrToZone(hr, config)` | Map HR to zone 1–5 based on threshold percentages of maxHR. |
| `zoneDistribution(samples, config)` | Time-in-zone distribution from timestamped HR samples. Skips gaps > 30s. |

### TRIMP

| Function | Description |
|----------|-------------|
| `trimp(samples, config)` | Bannister TRIMP. Sex factors: male=1.92, female=1.67, neutral=1.80. Skips gaps > 30s. |
| `weeklyTRIMP(sessions, weekStart)` | Aggregate TRIMP across sessions within a 7-day window. |

### Artifact Filter

| Function | Description |
|----------|-------------|
| `filterArtifacts(rr, options?)` | Filter artifact RR intervals. Returns `{ filtered, artifactRate }`. |

Options: `threshold` (default 0.2), `strategy` (`'remove'` or `'interpolate'`), `windowSize` (default 5).

### SessionRecorder

| Method / Property | Description |
|-------------------|-------------|
| `new SessionRecorder(config)` | Create with `{ maxHR, restHR?, zones? }`. Default zones: `[0.6, 0.7, 0.8, 0.9]`. |
| `ingest(packet)` | Feed an `HRPacket` into the session. |
| `startRound(meta?)` | Begin a new round with optional metadata. |
| `endRound(meta?)` | End the current round. Returns `Round`. Throws if no round in progress. |
| `currentHR()` | Latest ingested heart rate, or `null`. |
| `currentZone()` | Latest computed zone (1–5), or `null`. |
| `elapsedSeconds()` | Seconds since first ingested packet. |
| `end()` | Finalize session. Returns `Session` with all samples, RR intervals, and rounds. |
| `hr$` | Observable stream of HR values. Emits current value on subscribe. |
| `zone$` | Observable stream of zone values. Emits current value on subscribe. |

### Connection

| Function | Description |
|----------|-------------|
| `connectToDevice(transport, options?)` | Scan and connect to the best matching device. Options: `prefer`, `fallback`, `timeoutMs` (default 10s). |

### Constants

| Constant | Value |
|----------|-------|
| `GATT_HR_SERVICE_UUID` | `0000180d-0000-1000-8000-00805f9b34fb` |
| `GATT_HR_MEASUREMENT_UUID` | `00002a37-0000-1000-8000-00805f9b34fb` |
| `POLAR_PMD_SERVICE_UUID` | `fb005c80-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_CONTROL_UUID` | `fb005c81-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_DATA_UUID` | `fb005c82-02e7-f387-1cad-8acd2d8df0c8` |

### Profiles Sub-Export

```typescript
import { GENERIC_HR } from '@hrkit/core/profiles';
```

`GENERIC_HR` matches any BLE device advertising the standard HR service (empty `namePrefix`).
