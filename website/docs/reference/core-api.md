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

## Session Analysis

### `analyzeSession(session)`

Compute a full analysis of a recorded session. Filters artifacts before computing HRV. Uses single-pass reduce for performance.

```typescript
function analyzeSession(session: Session): SessionAnalysis;
```

**Returns:** `SessionAnalysis`

```typescript
interface SessionAnalysis {
  durationSec: number;
  sampleCount: number;
  rrCount: number;
  roundCount: number;
  hr: {
    mean: number;
    min: number;
    max: number;
    meanFromRR: number | null;
  };
  hrv: { rmssd: number; sdnn: number; pnn50: number } | null;
  artifacts: { filtered: number[]; artifactRate: number } | null;
  zones: ZoneDistribution;
  trimp: number;
}
```

```typescript
import { analyzeSession } from '@hrkit/core';

const result = analyzeSession(session);
console.log(`Duration: ${result.durationSec}s, Mean HR: ${result.hr.mean}`);
```

---

## Session Serialization

### `sessionToJSON(session)`

Serialize a session to a JSON string.

```typescript
function sessionToJSON(session: Session): string;
```

### `sessionFromJSON(json, options?)`

Deserialize a session from a JSON string.

```typescript
function sessionFromJSON(json: string, options?: SessionFromJSONOptions): Session;

interface SessionFromJSONOptions {
  strict?: boolean;                          // default: false
  migrators?: readonly SessionMigrator[];
}
```

### `sessionToCSV(session)`

Export session HR samples as CSV.

```typescript
function sessionToCSV(session: Session): string;
```

### `roundsToCSV(session)`

Export round-level summaries as CSV.

```typescript
function roundsToCSV(session: Session): string;
```

### `sessionToTCX(session, options?)`

Export session in Garmin TCX format.

```typescript
function sessionToTCX(
  session: Session,
  options?: {
    sport?: string;           // default: 'Other'
    includeRR?: boolean;      // default: true
    includeCalories?: boolean; // default: true
  }
): string;
```

---

## Streaming Metrics

### `RollingRMSSD`

Sliding-window RMSSD computation. Emits updated HRV on each ingest.

```typescript
class RollingRMSSD {
  readonly rmssd$: ReadableStream<WindowedHRV>;
  constructor(windowSize?: number, minSamples?: number);
  ingest(rrIntervals: number[], timestamp: number): void;
  reset(): void;
}

interface WindowedHRV {
  rmssd: number;
  timestamp: number;
  sampleCount: number;
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `windowSize` | `30` | Number of RR intervals in the sliding window |
| `minSamples` | `5` | Minimum samples before emitting |

### `TRIMPAccumulator`

Accumulates TRIMP in real time from a stream of HR values.

```typescript
class TRIMPAccumulator {
  readonly trimp$: ReadableStream<CumulativeTRIMP>;
  constructor(config: TRIMPConfig);
  ingest(hr: number, timestamp: number): void;
  reset(): void;
}

interface CumulativeTRIMP {
  trimp: number;
  timestamp: number;
}
```

---

## Advanced HRV

### `cleanRR(rr, opts?)`

Lipponen–Tarvainen artifact correction. Replaces detected artifacts with interpolated values.

```typescript
function cleanRR(
  rr: number[],
  opts?: {
    windowSize?: number;        // default: 5
    thresholdMs?: number;       // default: 250
    relativeThreshold?: number; // default: 0.20
  }
): CleanedRR;

interface CleanedRR {
  rr: number[];
  artefactIndices: number[];
}
```

### `poincare(rr)`

Poincaré plot descriptors — SD1 (short-term), SD2 (long-term), and their ratio.

```typescript
function poincare(rr: number[]): PoincareResult;

interface PoincareResult {
  sd1: number;
  sd2: number;
  ratio: number;
}
```

### `frequencyDomain(rr, opts?)`

Frequency-domain HRV via Lomb–Scargle periodogram.

```typescript
function frequencyDomain(
  rr: number[],
  opts?: { fStart?: number; fEnd?: number; nFreq?: number }
): FrequencyDomainResult;

interface FrequencyDomainResult {
  vlf: number;        // 0.003–0.04 Hz
  lf: number;         // 0.04–0.15 Hz
  hf: number;         // 0.15–0.4 Hz
  lfHfRatio: number;
  lfNu: number;
  hfNu: number;
  totalPower: number;
}
```

### `dfaAlpha1(rr, opts?)`

Detrended Fluctuation Analysis — short-term scaling exponent α1.

```typescript
function dfaAlpha1(
  rr: number[],
  opts?: { scaleMin?: number; scaleMax?: number }
): number;
```

### `hrvReport(rr)`

Comprehensive HRV report combining time-domain, nonlinear, and frequency-domain metrics. Automatically cleans artifacts before analysis.

```typescript
function hrvReport(rawRr: number[]): HRVReport;

interface HRVReport {
  n: number;
  artefactCount: number;
  time: { meanRR: number; meanHR: number; sdnn: number; rmssd: number; pnn50: number };
  nonlinear: { sd1: number; sd2: number; sd1Sd2Ratio: number; dfaAlpha1: number };
  frequency: FrequencyDomainResult;
}
```

```typescript
import { hrvReport } from '@hrkit/core';

const report = hrvReport(rrIntervals);
console.log(`RMSSD: ${report.time.rmssd}, DFA α1: ${report.nonlinear.dfaAlpha1}`);
```

---

## Stress Scoring

### `computeStress(input, weights?)`

Multi-factor stress score (0–100) combining HRV, heart rate, breathing rate, recovery, and subjective wellness.

```typescript
function computeStress(
  input: StressInput,
  weights?: Partial<StressWeights>
): StressResult;

interface StressInput {
  rrIntervals: number[];
  currentHR: number;
  restHR: number;
  baselineRmssd?: number;
  subjectiveWellness?: number;   // 1–10
}

interface StressResult {
  score: number;                 // 0–100
  level: 'low' | 'moderate' | 'high' | 'very_high';
  components: {
    hrv: number;
    heartRate: number;
    breathingRate: number;
    recovery: number | null;
    subjective: number | null;
  };
  breathingRateBPM: number | null;
  rmssd: number;
}

interface StressWeights {
  hrv: number;           // default: 0.35
  heartRate: number;     // default: 0.25
  breathingRate: number; // default: 0.20
  recovery: number;      // default: 0.15
  subjective: number;    // default: 0.05
}
```

### `estimateBreathingRate(rr)`

Estimate breathing rate from RR intervals. Returns `null` if insufficient data.

```typescript
function estimateBreathingRate(rr: number[]): number | null;
```

```typescript
import { computeStress } from '@hrkit/core';

const result = computeStress({
  rrIntervals: rr,
  currentHR: 72,
  restHR: 55,
  baselineRmssd: 45,
});
console.log(`Stress: ${result.score}/100 (${result.level})`);
```

---

## VO₂max Estimation

### `estimateVO2maxUth(maxHR, restHR)`

Uth–Sørensen–Overgaard–Pedersen estimate from resting and maximum heart rate.

```typescript
function estimateVO2maxUth(maxHR: number, restHR: number): VO2maxEstimate;
```

### `estimateVO2maxFromSession(input)`

Estimate from a steady-state session. Returns `null` if the session is too short or variable.

```typescript
function estimateVO2maxFromSession(input: VO2maxSessionInput): VO2maxEstimate | null;

interface VO2maxSessionInput {
  hrSamples: number[];
  durationMin: number;
  restHR: number;
  maxHR: number;
  sex?: 'male' | 'female';
}
```

### `estimateVO2maxCooper(distanceMeters)`

Cooper 12-minute run test estimate.

```typescript
function estimateVO2maxCooper(distanceMeters: number): VO2maxEstimate;
```

### `fitnessScore(vo2max, age, sex)`

Percentile ranking and fitness category for a given VO₂max.

```typescript
function fitnessScore(
  vo2max: number,
  age: number,
  sex: 'male' | 'female'
): FitnessScore;
```

**Shared types:**

```typescript
interface VO2maxEstimate {
  vo2max: number;
  method: 'uth' | 'session' | 'cooper';
  ciLower: number;
  ciUpper: number;
  confidence: number;   // 0–1
}

interface FitnessScore {
  vo2max: number;
  percentile: number;   // 1–100
  category: 'very_poor' | 'poor' | 'fair' | 'good' | 'excellent' | 'superior';
  ageGroup: string;
  sex: 'male' | 'female';
}
```

```typescript
import { estimateVO2maxUth, fitnessScore } from '@hrkit/core';

const est = estimateVO2maxUth(190, 55);
const fit = fitnessScore(est.vo2max, 30, 'male');
console.log(`VO2max: ${est.vo2max}, Category: ${fit.category}`);
```

---

## AFib Screening

### `screenForAFib(rr, options?)`

Screen RR intervals for atrial fibrillation markers using Shannon entropy, Poincaré SD1/SD2, coefficient of variation, and turning point ratio. Requires a minimum of 60 RR intervals.

:::warning
⚠️ **NOT A MEDICAL DEVICE.** This is a screening aid only. It does not diagnose atrial fibrillation or any medical condition. Always consult a qualified healthcare professional for diagnosis and treatment.
:::

```typescript
function screenForAFib(
  rr: number[],
  options?: AFibScreeningOptions
): AFibScreeningResult;

interface AFibScreeningOptions {
  minSamples?: number;         // default: 60
  entropyThreshold?: number;   // default: 3.0
  sd1sd2Threshold?: number;    // default: 0.6
  cvThreshold?: number;        // default: 15
}

interface AFibScreeningResult {
  classification: 'normal' | 'irregular' | 'inconclusive';
  confidence: number;          // 0–1
  shannonEntropy: number;
  sd1: number;
  sd2: number;
  sd1sd2Ratio: number;
  rrCoefficientOfVariation: number;
  turningPointRatio: number;
  sampleCount: number;
  disclaimer: string;
}
```

```typescript
import { screenForAFib } from '@hrkit/core';

const result = screenForAFib(rrIntervals);
console.log(`${result.classification} (confidence: ${result.confidence})`);
```

---

## Blood Pressure Estimation

### `extractPTT(input)`

Extract Pulse Transit Time values from synchronized R-peak and PPG-peak timestamps.

```typescript
function extractPTT(input: PTTInput): number[];

interface PTTInput {
  rPeakTimestamps: number[];
  ppgPeakTimestamps: number[];
}
```

### `estimateBloodPressure(ptts, calibration?)`

Estimate blood pressure from PTT values. Returns `null` if insufficient data.

:::warning
⚠️ **NOT A MEDICAL DEVICE.** PTT-based blood pressure estimates are investigational. Do not use for clinical decisions. Always verify with a validated cuff-based monitor.
:::

```typescript
function estimateBloodPressure(
  ptts: number[],
  calibration?: BPCalibration
): BPEstimate | null;

interface BPCalibration {
  systolic: number;
  diastolic: number;
  ptt: number;
  timestamp: number;
}

interface BPEstimate {
  systolic: number;
  diastolic: number;
  map: number;
  ptt: number;
  confidence: number;   // 0–1
  calibrated: boolean;
  timestamp: number;
  disclaimer: string;
}
```

```typescript
import { extractPTT, estimateBloodPressure } from '@hrkit/core';

const ptts = extractPTT({ rPeakTimestamps, ppgPeakTimestamps });
const bp = estimateBloodPressure(ptts, calibration);
if (bp) console.log(`${bp.systolic}/${bp.diastolic} mmHg`);
```

---

## Sensor Fusion

### `SensorFusion`

Kalman-filter-based sensor fusion that combines readings from multiple HR sources, weighting by quality priors and consistency.

```typescript
class SensorFusion {
  constructor(config?: FusionConfig);
  addSource(source: SensorSource): void;
  removeSource(id: string): void;
  pushReading(reading: SensorReading): void;
  getFused(now?: number): FusedOutput | null;
  getSourceQualities(): Map<string, number>;
  readonly sourceIds: string[];
}

interface FusionConfig {
  processNoise?: number;        // default: 0.5
  staleThresholdMs?: number;    // default: 5000
  minQuality?: number;          // default: 0.1
}
```

**Source & Reading types:**

```typescript
interface SensorSource {
  id: string;
  label: string;
  type: 'chest_strap' | 'optical_wrist' | 'optical_arm' | 'ecg' | 'other';
}

interface SensorReading {
  sourceId: string;
  hr: number;
  timestamp: number;
  rrIntervals?: number[];
}

interface FusedOutput {
  hr: number;
  uncertainty: number;
  timestamp: number;
  primarySourceId: string;
  sourceQualities: Map<string, number>;
  activeSourceCount: number;
}
```

:::info
Quality priors by sensor type: `ecg` = 0.95, `chest_strap` = 0.90, `optical_arm` = 0.75, `optical_wrist` = 0.65, `other` = 0.50.
:::

---

## Multi-Device Manager

### `MultiDeviceManager`

Manages multiple BLE devices with configurable fusion strategies.

```typescript
class MultiDeviceManager {
  constructor(config: MultiDeviceConfig);
  // ... add/remove devices, manage fusion
}

interface MultiDeviceConfig {
  strategy: FusionStrategyType;
  primaryDeviceId?: string;
  staleThresholdMs?: number;     // default: 3000
}

type FusionStrategyType = 'primary-fallback' | 'consensus' | 'best-rr';
```

| Strategy | Description |
|----------|-------------|
| `'primary-fallback'` | Use primary device, fall back to others if stale |
| `'consensus'` | Weighted average across all active devices |
| `'best-rr'` | Prefer the device with the highest RR interval quality |

**Observables:**

| Property | Type | Description |
|----------|------|-------------|
| `fused$` | `ReadableStream<FusedHRPacket>` | Fused HR output |
| `quality$` | `ReadableStream<DeviceQuality[]>` | Per-device quality scores |

```typescript
interface FusedHRPacket extends HRPacket {
  sourceDeviceIds: string[];
  fusionStrategy: FusionStrategyType;
}

interface DeviceQuality {
  deviceId: string;
  deviceName: string;
  packetCount: number;
  dropCount: number;
  artifactRate: number;
  avgIntervalMs: number;
  qualityScore: number;   // 0–1
  lastPacketTime: number;
}
```

---

## Session Replay

### `SessionPlayer`

Replay a recorded session with real-time playback, speed control, seeking, and annotations.

```typescript
class SessionPlayer {
  readonly sample$: ReadableStream<ReplayEvent>;
  readonly state$: ReadableStream<ReplayState>;

  constructor(session: Session);

  get currentState(): ReplayState;
  get currentSampleIndex(): number;
  get allAnnotations(): readonly Annotation[];

  play(speed?: number): void;
  pause(): void;
  stop(): void;
  seekToIndex(index: number): void;
  seekToTime(timestamp: number): void;
  setSpeed(speed: number): void;

  addAnnotation(timestamp: number, text: string, options?: {
    type?: 'note' | 'highlight' | 'issue' | 'technique';
    author?: string;
  }): Annotation;
  removeAnnotation(id: string): boolean;
  getAnnotationsInRange(startTs: number, endTs: number): Annotation[];

  dispose(): void;
}
```

**Types:**

```typescript
type ReplayState = 'idle' | 'playing' | 'paused' | 'completed';

interface ReplayEvent {
  sample: TimestampedHR;
  index: number;
  total: number;
  speed: number;
  progress: number;      // 0–1
  elapsedMs: number;
  totalMs: number;
}

interface Annotation {
  id: string;
  timestamp: number;
  text: string;
  type?: 'note' | 'highlight' | 'issue' | 'technique';
  author?: string;
  createdAt: number;
}
```

---

## Training Plans

### `createWeeklyPlan(name, weeks)`

Create a structured training plan from weekly schedules.

```typescript
function createWeeklyPlan(name: string, weeks: TrainingWeek[]): TrainingPlan;
```

### `PlanRunner`

Execute and track progress through a training plan.

```typescript
class PlanRunner {
  constructor(plan: TrainingPlan);
  get currentProgress(): Readonly<PlanProgress>;
  get currentPlan(): Readonly<TrainingPlan>;
  getSession(dayOfWeek: number): TrainingDay | null;
  getCurrentWeek(): TrainingWeek | null;
  markCompleted(dayOfWeek: number): void;
  markSkipped(dayOfWeek: number): void;
  advanceToNextWeek(): void;
}
```

**Types:**

```typescript
interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version: 1;
  blocks: TrainingBlock[];
  tags?: string[];
}

interface TrainingWeek {
  weekNumber: number;
  label?: string;
  days: TrainingDay[];
}

interface TrainingDay {
  dayOfWeek: number;    // 0=Sun … 6=Sat
  dsl: string;
  protocol?: WorkoutProtocol;
  isRest?: boolean;
  notes?: string;
}

interface PlanProgress {
  blockIndex: number;
  weekIndex: number;
  completedDays: number[];
  skippedDays: number[];
  complianceRate: number;  // 0–1
  totalCompleted: number;
  totalPrescribed: number;
}
```

---

## Training Insights

### `getTrainingRecommendation(input)`

Generate a training recommendation based on ACWR, HRV trend, freshness, and recovery status.

```typescript
function getTrainingRecommendation(input: InsightInput): TrainingRecommendation;

interface TrainingRecommendation {
  verdict: 'go_hard' | 'moderate' | 'easy' | 'rest' | 'deload';
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  prescription: ZonePrescription;
  confidence: number;       // 0–1
  reasons: InsightReason[];
  summary: string;
}

interface ZonePrescription {
  primaryZone: 1 | 2 | 3 | 4 | 5;
  maxZone: 1 | 2 | 3 | 4 | 5;
  suggestedDurationMin: number;
}
```

### `assessACWRRisk(acwr)`

Classify acute:chronic workload ratio risk level.

```typescript
function assessACWRRisk(acwr: number): 'low' | 'moderate' | 'high' | 'critical';
```

### `analyzeHRVTrend(trend)`

Detect trend direction and whether it signals concern.

```typescript
function analyzeHRVTrend(trend: HRVTrendPoint[]): {
  direction: 'improving' | 'stable' | 'declining';
  magnitude: number;
  concern: boolean;
};
```

### `calculateMonotony(trainingLoad)`

Training monotony score — high values (>2.0) indicate insufficient variation.

```typescript
function calculateMonotony(trainingLoad: TrainingLoadPoint[]): number;
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `ACWR_CRITICAL` | `1.5` | Acute:chronic ratio — critical injury risk |
| `ACWR_HIGH` | `1.3` | Acute:chronic ratio — elevated risk |
| `ACWR_UNDERTRAINED` | `0.8` | Below this → undertrained |
| `MONOTONY_HIGH` | `2.0` | Monotony above this → increase variety |
| `TSB_DELOAD_THRESHOLD` | `-20` | Training Stress Balance threshold for deload |

---

## Non-HR Sensor Parsers

### `parseCyclingPower(view, timestamp?)`

Parse BLE Cycling Power Measurement characteristic.

```typescript
function parseCyclingPower(view: DataView, timestamp?: number): CyclingPowerPacket;

interface CyclingPowerPacket {
  timestamp: number;
  power: number;
  pedalPowerBalancePct?: number;
  crankRevolutions?: number;
  crankEventTime?: number;
  wheelRevolutions?: number;
  wheelEventTime?: number;
}
```

### `parseCSC(view, timestamp?)`

Parse BLE Cycling Speed and Cadence characteristic.

```typescript
function parseCSC(view: DataView, timestamp?: number): CSCPacket;

interface CSCPacket {
  timestamp: number;
  wheelRevolutions?: number;
  wheelEventTime?: number;
  crankRevolutions?: number;
  crankEventTime?: number;
}
```

### `parseRSC(view, timestamp?)`

Parse BLE Running Speed and Cadence characteristic.

```typescript
function parseRSC(view: DataView, timestamp?: number): RSCPacket;

interface RSCPacket {
  timestamp: number;
  speedMps: number;
  cadenceSpm: number;
  strideLengthM?: number;
  totalDistanceM?: number;
  isRunning?: boolean;
}
```

### `parsePulseOxContinuous(view, timestamp?)`

Parse BLE Pulse Oximeter continuous measurement.

```typescript
function parsePulseOxContinuous(view: DataView, timestamp?: number): SpO2Packet;

interface SpO2Packet {
  timestamp: number;
  spo2Pct: number;
  pulseRateBpm: number;
}
```

### `computeCadenceRPM(prev, curr)`

Compute cadence in RPM from two consecutive CSC packets.

```typescript
function computeCadenceRPM(
  prev: { crankRevolutions: number; crankEventTime: number },
  curr: { crankRevolutions: number; crankEventTime: number }
): number;
```

---

## Error Types

All errors extend the base `HRKitError` class.

```typescript
class HRKitError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string);
}
```

| Class | Extends | Description |
|-------|---------|-------------|
| `ParseError` | `HRKitError` | Invalid BLE data or malformed input |
| `ConnectionError` | `HRKitError` | BLE connection failure |
| `TimeoutError` | `HRKitError` | Operation exceeded time limit |
| `DeviceNotFoundError` | `HRKitError` | No matching device discovered |
| `ValidationError` | `HRKitError` | Input validation failure (carries `errors[]` and `warnings[]`) |
| `RequestError` | `HRKitError` | HTTP request failure (carries `status`, `requestId`, `responseBody`) |
| `AuthError` | `RequestError` | Authentication / authorization failure |
| `RateLimitError` | `RequestError` | Rate limit exceeded (carries `retryAfterSeconds`) |
| `ServerError` | `RequestError` | Server-side error (5xx) |

### `isRetryable(error)`

Check whether an error is safe to retry (e.g., timeouts, rate limits, server errors).

```typescript
function isRetryable(err: unknown): boolean;
```

### `formatError(error)`

Format any error into a human-readable string.

```typescript
function formatError(err: unknown): string;
```

---

## Validation Utilities

### Packet & Config Validators

```typescript
function validateHRPacket(packet: HRPacket, config?: ValidationConfig): ValidationResult;
function validateSession(session: Session): ValidationResult;
function validateSessionConfig(config: SessionConfig): ValidationResult;
function validateZoneConfig(config: HRZoneConfig): ValidationResult;

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

interface ValidationConfig {
  hrRange?: [min: number, max: number];   // default: [30, 250]
  rrRange?: [min: number, max: number];   // default: [200, 2000]
}
```

### Statistical Agreement

### `blandAltman(reference, measured)`

Bland–Altman analysis for comparing a test sensor against a reference.

```typescript
function blandAltman(
  reference: readonly number[],
  measured: readonly number[]
): BlandAltmanResult;

interface BlandAltmanResult {
  bias: number;
  sd: number;
  loaLower: number;
  loaUpper: number;
  n: number;
  points: Array<{ mean: number; diff: number }>;
}
```

### `mape(reference, measured)`

Mean Absolute Percentage Error between reference and measured values.

```typescript
function mape(
  reference: readonly number[],
  measured: readonly number[]
): MAPEResult;

interface MAPEResult {
  mape: number;   // percent
  n: number;
}
```

---

## Logger

### `getLogger()` / `setLogger(logger)`

Global logger used by all `@hrkit/core` internals. Defaults to `NoopLogger`.

```typescript
function getLogger(): Logger;
function setLogger(logger: Logger): void;

interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
```

### Built-in loggers

| Constant | Description |
|----------|-------------|
| `ConsoleLogger` | Logs to `console` with level prefix |
| `NoopLogger` | Silently discards all messages (default) |

### `redact(value)`

Deep-clone a value, replacing strings that look like tokens or secrets with `'[REDACTED]'`.

```typescript
function redact<T>(value: T, seen?: WeakSet<object>): T;
```

---

## Retry Utilities

### `retry(fn, options?)`

Retry an async operation with exponential backoff and jitter.

```typescript
function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T>;

interface RetryOptions {
  maxAttempts?: number;             // default: 5
  initialDelayMs?: number;          // default: 1000
  maxDelayMs?: number;              // default: 30000
  backoffMultiplier?: number;       // default: 2
  jitter?: 'none' | 'full' | 'equal'; // default: 'full'
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (info: { attempt: number; delay: number; error: unknown }) => void;
  signal?: AbortSignal;
}
```

### `sleep(ms, signal?)`

Promise-based delay with optional `AbortSignal` cancellation.

```typescript
function sleep(ms: number, signal?: AbortSignal): Promise<void>;
```

### `timeout(fn, ms, message?)`

Wrap an async operation with a timeout. Throws `TimeoutError` if `ms` elapses.

```typescript
function timeout<T>(
  fn: () => Promise<T>,
  ms: number,
  message?: string
): Promise<T>;
```

---

## Athlete Store

### `InMemoryAthleteStore`

In-memory implementation of `AthleteStore` for session history, HRV trends, and training load tracking.

```typescript
class InMemoryAthleteStore implements AthleteStore {
  saveSession(session: Session): string;
  getSessions(limit?: number): SessionSummary[];
  getSessionsBetween(from: number, to: number): SessionSummary[];
  getSession(id: string): SessionSummary | undefined;
  deleteSession(id: string): boolean;
  getHRVTrend(days?: number): HRVTrendPoint[];
  getTrainingLoadTrend(days?: number): TrainingLoadPoint[];
  getCurrentACWR(): number | null;
  getSessionCount(): number;
}
```

**Key types:**

```typescript
interface SessionSummary {
  id: string;
  startTime: number;
  endTime: number;
  durationSec: number;
  meanHR: number;
  maxHR: number;
  trimp: number;
  rmssd: number | null;
  roundCount: number;
  activityType?: string;
}

interface HRVTrendPoint {
  date: string;        // ISO 8601
  rmssd: number;
  rollingAvg: number;
  cv: number;
}

interface TrainingLoadPoint {
  date: string;        // ISO 8601
  atl: number;
  ctl: number;
  acwr: number;
  tsb: number;
}
```

---

## Workout DSL

### `parseWorkoutDSL(dsl)`

Parse a human-readable workout description into a structured protocol.

```typescript
function parseWorkoutDSL(dsl: string): WorkoutProtocol;
```

### `workoutToDSL(protocol)`

Serialize a `WorkoutProtocol` back to DSL text.

```typescript
function workoutToDSL(protocol: WorkoutProtocol): string;
```

### `WorkoutCues`

Voice cue announcer for workout steps and countdowns.

```typescript
class WorkoutCues {
  constructor(speaker: SpeakLike, opts?: { countdownAt?: number[] });
  announceStep(step: WorkoutStep, indexInProtocol: number): void;
  tick(secondsRemaining: number, stepIndex: number): void;
  cancel(): void;
}
```

### `PROTOCOL_LIBRARY`

Pre-built workout protocols.

```typescript
const PROTOCOL_LIBRARY: Record<string, WorkoutProtocol>;
```

| Key | Protocol |
|-----|----------|
| `'Tabata'` | 20s work / 10s rest × 8 |
| `'Norwegian 4x4'` | 4 × 4 min at 90–95% HRmax |
| `'MAF 45'` | 45 min at MAF heart rate |
| `'BJJ Rounds'` | 5 min rounds with 1 min rest |

Individual protocols are also available as named exports: `TABATA`, `NORWEGIAN_4X4`, `MAF_45`, `BJJ_ROUNDS`.

---

## Profiles Sub-Export

```typescript
import { GENERIC_HR } from '@hrkit/core/profiles';
```

`GENERIC_HR` matches any BLE device advertising the standard Heart Rate service.
