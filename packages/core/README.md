# @hrkit/core

Zero-dependency TypeScript library for BLE heart rate sensor data processing. Platform-agnostic — works on any runtime that can provide BLE data.

## Install

```bash
npm install @hrkit/core
# or
pnpm add @hrkit/core
```

## Features

- **GATT HR Parser** — Parse BLE Heart Rate Measurement characteristic (0x2A37) with bounds checking
- **HRV Metrics** — RMSSD, SDNN, pNN50, mean HR, baseline tracking, readiness verdict
- **Zone Calculator** — 5-zone HR mapping with time-in-zone distribution and zone presets
- **TRIMP** — Bannister training impulse with sex-based weighting
- **Artifact Filter** — RR interval artifact detection with remove or interpolate strategies
- **Real-Time Artifact Detection** — Live artifact flagging via observable stream
- **Session Recorder** — Stateful session recording with round tracking, pause/resume, observable streams
- **Session Serialization** — JSON round-trip, CSV export, TCX export (Strava/Garmin compatible)
- **Session Analysis** — One-call `analyzeSession()` for HRV, TRIMP, zones, and artifact metrics
- **Streaming Metrics** — Rolling RMSSD and live TRIMP accumulation during recording
- **Data Validation** — HR and RR interval range checking
- **Connection Management** — Reconnection with exponential backoff and connection state observable
- **Device Profiles** — Capability-based device abstraction with zone presets and athlete profiles
- **Error Hierarchy** — Structured errors: `ParseError`, `ConnectionError`, `TimeoutError`, `DeviceNotFoundError`
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
| `weeklyTRIMP(sessions, weekStart, sex?)` | Aggregate TRIMP across sessions within a 7-day window. Uses session config sex, falls back to provided default. |

### Session Analysis

| Function | Description |
|----------|-------------|
| `analyzeSession(session)` | One-call post-session analysis. Returns HR stats, HRV (RMSSD/SDNN/pNN50), artifact rate, zone distribution, and TRIMP. |

### Session Serialization

| Function | Description |
|----------|-------------|
| `sessionToJSON(session)` | Serialize a Session to JSON string with schema version. |
| `sessionFromJSON(json)` | Deserialize and validate a Session from JSON. Throws `ParseError` on invalid data. |
| `sessionToCSV(session, options?)` | Export samples as CSV. Optional `includeRR` flag. |
| `roundsToCSV(session)` | Export round data as CSV. |
| `sessionToTCX(session, options?)` | Export as TCX (Training Center XML) for Strava/Garmin. Optional `sport` type. |

### Data Validation

| Function | Description |
|----------|-------------|
| `validateHRPacket(packet, config?)` | Validate HR (default 30–250 bpm) and RR (default 200–2000 ms) ranges. Returns `{ valid, warnings }`. |

### Artifact Filter

| Function | Description |
|----------|-------------|
| `filterArtifacts(rr, options?)` | Filter artifact RR intervals. Returns `{ filtered, artifactRate }`. |

Options: `threshold` (default 0.2), `strategy` (`'remove'` or `'interpolate'`), `windowSize` (default 5).

### SessionRecorder

| Method / Property | Description |
|-------------------|-------------|
| `new SessionRecorder(config)` | Create with `{ maxHR, restHR?, zones?, sex? }`. Default zones: `[0.6, 0.7, 0.8, 0.9]`. |
| `ingest(packet)` | Feed an `HRPacket` into the session. Ignored when paused. |
| `startRound(meta?)` | Begin a new round with optional metadata. |
| `endRound(meta?)` | End the current round. Returns `Round`. Throws if no round in progress. |
| `pause()` | Pause recording. Ingested packets are ignored until `resume()`. |
| `resume()` | Resume recording after a pause. |
| `paused` | Whether the recorder is currently paused (readonly). |
| `setDeviceInfo(info)` | Attach device info `{ id, name, profile? }` to the session. |
| `setMetadata(data)` | Attach arbitrary metadata to the session. |
| `currentHR()` | Latest ingested heart rate, or `null`. |
| `currentZone()` | Latest computed zone (1–5), or `null`. |
| `elapsedSeconds()` | Seconds since first ingested packet (based on packet timestamps). |
| `end()` | Finalize session. Returns `Session` with `schemaVersion`, samples, RR intervals, rounds, device info, and metadata. |
| `hr$` | Observable stream of HR values. Emits current value on subscribe. |
| `zone$` | Observable stream of zone values. Emits current value on subscribe. |

### Connection

| Function | Description |
|----------|-------------|
| `connectToDevice(transport, options?)` | Scan and connect to the best matching device. Options: `prefer`, `fallback`, `timeoutMs` (default 10s). |
| `connectWithRetry(transport, deviceId, profile, config?)` | Connect with automatic retry and exponential backoff. Returns `ManagedConnection` with `state$` observable. |
| `connectWithReconnect(...)` | Deprecated alias for `connectWithRetry`. |

### Streaming Metrics

| Class | Description |
|-------|-------------|
| `RollingRMSSD(windowSize?, minSamples?)` | Windowed RMSSD calculator. Emits via `rmssd$` stream. Call `ingest(rrIntervals, timestamp)`. |
| `TRIMPAccumulator(config)` | Live cumulative TRIMP. Emits via `trimp$` stream. Call `ingest(hr, timestamp)`. |

### Real-Time Artifact Detection

| Class | Description |
|-------|-------------|
| `RealtimeArtifactDetector(windowSize?, threshold?)` | Flags artifact RR intervals in real-time. Emits `ArtifactEvent` via `artifacts$` stream. |

### Zone Presets & Athlete Profile

| Export | Description |
|--------|-------------|
| `ZONE_PRESETS` | Built-in zone thresholds: `'5-zone'` (0.6/0.7/0.8/0.9), `'3-zone'` (0.7/0.85/0.95/1.0). |
| `toSessionConfig(profile)` | Derive `SessionConfig` from an `AthleteProfile`. |
| `toZoneConfig(profile)` | Derive `HRZoneConfig` from an `AthleteProfile`. |
| `toTRIMPConfig(profile)` | Derive `TRIMPConfig` from an `AthleteProfile`. |

### Training Insights

Rule-based training recommendations from training load and HRV data — no ML required.

| Function | Description |
|----------|-------------|
| `getTrainingRecommendation(input)` | Generate a `TrainingRecommendation` with verdict, risk level, zone prescription, and reasoning. |
| `assessACWRRisk(acwr)` | Assess injury risk from ACWR: `'low'`, `'moderate'`, `'high'`, or `'critical'`. |
| `analyzeHRVTrend(trend)` | Analyze HRV trend direction, magnitude, and concern flag. |
| `calculateMonotony(trainingLoad)` | Calculate training monotony (mean / stddev of daily load). > 2.0 = too repetitive. |

Constants: `ACWR_CRITICAL` (1.5), `ACWR_HIGH` (1.3), `ACWR_UNDERTRAINED` (0.8), `MONOTONY_HIGH` (2.0), `TSB_DELOAD_THRESHOLD` (-20), `HRV_POOR_RECOVERY` (0.8), `HRV_WELL_RECOVERED` (0.95).

```typescript
import { getTrainingRecommendation } from '@hrkit/core';

const rec = getTrainingRecommendation({
  trainingLoad: store.getTrainingLoadTrend(),
  hrvTrend: store.getHRVTrend(),
  todayRmssd: 42,
  baselineRmssd: 45,
  maxHR: 185,
});
console.log(rec.verdict, rec.summary);
// → 'moderate', 'Moderate effort today...'
```

### Athlete Longitudinal Store

| Export | Description |
|--------|-------------|
| `InMemoryAthleteStore` | In-memory implementation of `AthleteStore`. Stores session summaries, computes daily TRIMP/rMSSD aggregates. |

Key methods: `saveSession(session)`, `getSessions(limit?)`, `getHRVTrend(days?)`, `getTrainingLoadTrend(days?)`, `getCurrentACWR()`.

### Workout Protocol Engine

Define and execute structured workouts with step-by-step progression and target compliance.

| Export | Description |
|--------|-------------|
| `WorkoutEngine` | Executes a `WorkoutProtocol`, tracking step progression and HR target compliance. Emits `step$`, `target$`, `state$` observables. |
| `tabataProtocol()` | 20s work / 10s rest × 8 rounds with warmup/cooldown. |
| `emomProtocol(minutes, workSec)` | Every-minute-on-the-minute intervals. |
| `pyramidProtocol(steps, restSec)` | Ascending/descending work durations. |
| `bjjRoundsProtocol(rounds, workSec, restSec)` | BJJ sparring rounds with warmup/cooldown. |
| `intervalProtocol(rounds, workSec, restSec)` | Simple repeated work/rest cycles. |

```typescript
import { WorkoutEngine, tabataProtocol, hrToZone } from '@hrkit/core';

const engine = new WorkoutEngine(tabataProtocol(), zoneConfig);
engine.step$.subscribe(({ step }) => console.log(`Step: ${step.name}`));
engine.start(Date.now());
// Feed HR packets: engine.ingest(packet)
```

### Multi-Device Fusion

Manage multiple simultaneous BLE HR connections and fuse their data.

| Export | Description |
|--------|-------------|
| `MultiDeviceManager` | Manages multiple HR connections with quality scoring and data fusion. Emits `fused$` and `quality$` observables. |

Fusion strategies: `'primary-fallback'` (use primary, fall back on stale), `'consensus'` (median HR across devices), `'best-rr'` (lowest artifact rate for RR intervals).

```typescript
import { MultiDeviceManager } from '@hrkit/core';

const manager = new MultiDeviceManager({ strategy: 'consensus' });
manager.addConnection(conn1);
manager.addConnection(conn2);
manager.fused$.subscribe((packet) => recorder.ingest(packet));
```

### Group Session

Orchestrate multi-athlete group sessions for instructor dashboards.

| Export | Description |
|--------|-------------|
| `GroupSession` | Tracks multiple athletes simultaneously. Computes per-athlete zones, TRIMP, and group aggregates. Emits `athletes$`, `heatmap$`, `stats$` observables. |

Key methods: `addAthlete(config)`, `ingest(athleteId, packet)`, `getLeaderboard(metric)`, `getHeatmap()`, `end()`.

### Plugin Architecture

Extend the SDK with custom lifecycle hooks.

| Export | Description |
|--------|-------------|
| `PluginRegistry` | Manages plugins that hook into the packet/session lifecycle. Methods: `register(plugin)`, `processPacket(packet)`, `collectAnalytics(session)`. |

Plugins implement the `HRKitPlugin` interface with optional hooks: `onInit`, `onPacket`, `onRoundStart`, `onRoundEnd`, `onSessionEnd`, `onAnalyze`, `onDestroy`.

### Observable Stream

| Export | Description |
|--------|-------------|
| `SimpleStream<T>` | Minimal observable with BehaviorSubject-like semantics. Used by all `$`-suffixed properties. Methods: `subscribe(listener)`, `get()`, `emit(value)`. |

### Error Types

| Error | When |
|-------|------|
| `HRKitError` | Base class for all @hrkit errors. |
| `ParseError` | Truncated or malformed BLE data. |
| `ConnectionError` | BLE connection failure or reconnection exhausted. |
| `TimeoutError` | Scan or connection timeout exceeded. |
| `DeviceNotFoundError` | No compatible device found during scan. |

### Constants

| Constant | Value |
|----------|-------|
| `GATT_HR_SERVICE_UUID` | `0000180d-0000-1000-8000-00805f9b34fb` |
| `GATT_HR_MEASUREMENT_UUID` | `00002a37-0000-1000-8000-00805f9b34fb` |
| `POLAR_PMD_SERVICE_UUID` | `fb005c80-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_CONTROL_UUID` | `fb005c81-02e7-f387-1cad-8acd2d8df0c8` |
| `POLAR_PMD_DATA_UUID` | `fb005c82-02e7-f387-1cad-8acd2d8df0c8` |

### Profiles

```typescript
import { GENERIC_HR } from '@hrkit/core';
// or from sub-export:
import { GENERIC_HR } from '@hrkit/core/profiles';
```

`GENERIC_HR` matches any BLE device advertising the standard HR service (empty `namePrefix`).

### Built-in Device Profiles

Available from `@hrkit/core` or `@hrkit/core/profiles`:

| Profile | Brand | Model | Capabilities |
|---------|-------|-------|-------------|
| `GENERIC_HR` | Generic | Any BLE HR sensor | heartRate, rrIntervals |
| `GARMIN_HRM_PRO` | Garmin | HRM-Pro | heartRate, rrIntervals |
| `GARMIN_HRM_DUAL` | Garmin | HRM-Dual | heartRate, rrIntervals |
| `GARMIN_HRM_RUN` | Garmin | HRM-Run | heartRate, rrIntervals |
| `WAHOO_TICKR` | Wahoo | TICKR | heartRate, rrIntervals |
| `WAHOO_TICKR_X` | Wahoo | TICKR X | heartRate, rrIntervals |
| `WAHOO_TICKR_FIT` | Wahoo | TICKR FIT | heartRate, rrIntervals |
| `MAGENE_H64` | Magene | H64 | heartRate, rrIntervals |
| `MAGENE_H303` | Magene | H303 | heartRate, rrIntervals |
| `SUUNTO_SMART_SENSOR` | Suunto | Smart Sensor | heartRate, rrIntervals |
| `COOSPO_H6` | Coospo | H6 | heartRate, rrIntervals |
| `COOSPO_H808S` | Coospo | H808S | heartRate, rrIntervals |

For Polar devices with ECG/ACC support, see [`@hrkit/polar`](../polar/).
