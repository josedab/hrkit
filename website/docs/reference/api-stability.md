---
sidebar_position: 5
title: API Stability
description: Stability levels for every public API in @hrkit — know what's production-ready and what may change.
---

# API Stability Matrix

Every public export in @hrkit is classified by stability level so you can make informed dependency decisions.

| Level | Badge | Meaning |
|-------|-------|---------|
| **Stable** | ✅ | Production-ready. Breaking changes only in major versions. |
| **Experimental** | 🧪 | Functional and tested, but the API surface may change in minor `0.x` releases. |
| **Deprecated** | ⛔ | Scheduled for removal. Migration path documented below. |

:::tip Versioning convention
All packages follow [semver](https://semver.org/). Packages at `0.x` are pre-1.0 and may introduce breaking changes in minor releases. `@hrkit/core` is at **0.2.x** and approaching 1.0 stability; all other packages are at **0.1.x**.
:::

---

## @hrkit/core

### ✅ Stable

These modules form the foundation of the SDK. Their public API is locked and will not change without a major version bump.

| Module | Exports | Description |
|--------|---------|-------------|
| `gatt-parser` | `parseHeartRate` | BLE Heart Rate Measurement (0x2A37) parser |
| `hrv` | `rmssd`, `sdnn`, `pnn50`, `meanHR`, `hrBaseline`, `readinessVerdict` | Core HRV metrics |
| `zones` | `hrToZone`, `zoneDistribution` | 5-zone HR mapping and time-in-zone |
| `trimp` | `trimp`, `weeklyTRIMP` | Bannister training impulse |
| `artifact-filter` | `filterArtifacts` | RR interval artifact detection and cleaning |
| `session-recorder` | `SessionRecorder` | Stateful session recording with rounds and pause/resume |
| `session-serialization` | `sessionToJSON`, `sessionFromJSON`, `sessionToCSV`, `roundsToCSV` | Session round-trip serialization |
| `export-tcx` | `sessionToTCX` | TCX export (Strava/Garmin compatible) |
| `analyze` | `analyzeSession` | One-call session analysis (HRV + TRIMP + zones) |
| `errors` | `HRKitError`, `ParseError`, `ConnectionError`, `TimeoutError`, `DeviceNotFoundError`, `ValidationError`, `RequestError`, `AuthError`, `RateLimitError`, `ServerError`, `isRetryable`, `formatError` | Structured error hierarchy |
| `types` | `HRPacket`, `BLETransport`, `HRConnection`, `DeviceProfile`, `Session`, `Round`, etc. | Core type definitions |
| `stream` | `SimpleStream` | Minimal observable stream (BehaviorSubject-like) |
| `plugin` | `PluginRegistry`, `HRKitPlugin` | Plugin architecture |
| `logger` | `setLogger`, `getLogger`, `ConsoleLogger`, `NoopLogger`, `redact` | Pluggable logger with PII redaction |
| `connect` | `connectToDevice` | Device connection |
| `connection` | `connectWithReconnect`, `connectWithRetry` | Connection management with retry/reconnect |
| `mock-transport` | `MockTransport` | In-memory BLE transport for testing |
| `retry` | `retry`, `sleep`, `timeout` | Retry and timeout utilities |
| `validators` | `validateHRPacket`, `validateSession`, `validateSessionConfig`, `validateZoneConfig` | Input validators |
| `validation` | `blandAltman`, `mape`, `validateAgainstReference` | Statistical validation (Bland-Altman, MAPE) |
| `zone-presets` | `ZONE_PRESETS`, `toZoneConfig`, `toTRIMPConfig`, `toSessionConfig` | Zone configuration presets |
| `windowed-metrics` | `RollingRMSSD`, `TRIMPAccumulator` | Sliding-window streaming metrics |
| `session-migrations` | `migrateSession`, `isCurrentSchema` | Schema versioning and migration |
| `athlete-store` | `InMemoryAthleteStore` | Longitudinal athlete data store |
| `sensors` | `parseCyclingPower`, `parseCSC`, `parseRSC`, `parsePulseOxContinuous` | Non-HR sensor parsers (power, cadence, SpO2) |
| `fusion` | `fuseStreams`, `MemoryGlucoseSource`, FTMS control encoders | FTMS trainer control and stream fusion |
| `conformance` | `verifyFixture`, `recordNotification` | Conformance test infrastructure |
| `profiles/*` | `POLAR_*`, `GARMIN_*`, `WAHOO_*`, `GENERIC_HR`, etc. | Built-in device profiles |
| `constants` | `GATT_HR_SERVICE_UUID`, `SESSION_SCHEMA_VERSION`, etc. | BLE and schema constants |

### 🧪 Experimental

These modules are functional and tested but may see API changes in minor releases as they mature.

| Module | Exports | Description | Why experimental |
|--------|---------|-------------|------------------|
| `afib-screening` | `screenForAFib`, `shannonEntropyRR`, `poincareDescriptors`, `turningPointRatio` | AFib rhythm screening | Medical analysis — thresholds may be refined; **not a medical device** |
| `bp-estimation` | `estimateBloodPressure`, `extractPTT` | Blood pressure estimation from PTT | Calibration model under active research |
| `stress` | `computeStress`, `estimateBreathingRate` | Composite stress scoring | Weight tuning and scoring model may evolve |
| `vo2max` | `estimateVO2maxFromSession`, `estimateVO2maxCooper`, `estimateVO2maxUth`, `fitnessScore` | VO2max estimation | Multiple algorithm variants; API may consolidate |
| `coherence` | `coherenceScore` | HRV coherence (parasympathetic balance) | Scoring algorithm may be refined |
| `hrv-advanced` | `poincare`, `dfaAlpha1`, `frequencyDomain`, `hrvReport`, `cleanRR` | Advanced HRV (Poincaré, DFA α1, FFT) | Algorithm parameters may change |
| `sensor-bus` | `SensorBus`, `SensorEvent`, `SensorEventKind` | Multi-sensor event pub/sub | v2 sensor architecture, event schema may expand |
| `sensor-fusion` | `SensorFusion` | Kalman filter multi-source HR fusion | Newest module — fusion algorithm under tuning |
| `multi-device` | `MultiDeviceManager` | Multi-device session management | Fusion strategy API may evolve |
| `group-session` | `GroupSession` | Multi-athlete group tracking | Leaderboard and alert APIs may change |
| `training-plan` | `PlanRunner`, `createWeeklyPlan` | Periodized training plan execution | Plan schema and compliance model maturing |
| `training-insights` | `getTrainingRecommendation`, `assessACWRRisk`, `analyzeHRVTrend`, `calculateMonotony` | Training load analytics (ACWR, TSB, monotony) | Threshold constants may be adjusted |
| `workout-protocol` | `WorkoutEngine`, `tabataProtocol`, `intervalProtocol`, etc. | Workout state machine | Step/target schema may expand |
| `workout-dsl` | `parseWorkoutDSL`, `workoutToDSL`, `WorkoutCues`, `PROTOCOL_LIBRARY` | Workout DSL parser and cue system | DSL grammar may gain new directives |
| `session-replay` | `SessionPlayer` | Session replay with annotations | Replay event model may change |
| `realtime-artifacts` | `RealtimeArtifactDetector` | Live artifact flagging via stream | Detection thresholds may be tuned |

---

## Packages

All packages outside `@hrkit/core` are at **0.1.x** and classified as **🧪 Experimental** per semver convention.

### Platform Adapters

| Package | Stability | Description |
|---------|-----------|-------------|
| `@hrkit/web` | 🧪 Experimental | Web Bluetooth API adapter |
| `@hrkit/react-native` | 🧪 Experimental | React Native adapter (`react-native-ble-plx`) |
| `@hrkit/capacitor` | 🧪 Experimental | Capacitor adapter (`@capacitor-community/bluetooth-le`) |
| `@hrkit/capacitor-native` | 🧪 Experimental | Native Capacitor plugin (CoreBluetooth / android.bluetooth) |
| `@hrkit/ant` | 🧪 Experimental | ANT+ heart rate bridge |
| `@hrkit/polar` | 🧪 Experimental | Polar PMD protocol (ECG + accelerometer) |

### Streaming & Infrastructure

| Package | Stability | Description |
|---------|-----------|-------------|
| `@hrkit/server` | 🧪 Experimental | WebSocket + SSE broadcasting server |
| `@hrkit/sync` | 🧪 Experimental | Local-first CRDT sync — **early stage**, minimal implementation |
| `@hrkit/edge` | 🧪 Experimental | Edge-runtime HR ingestion (Cloudflare Workers / Deno / Bun) |
| `@hrkit/otel` | 🧪 Experimental | OpenTelemetry instrumentation hooks |
| `@hrkit/bundle` | 🧪 Experimental | Conformance bundle signing (Web Crypto ECDSA) |

### Analysis & AI

| Package | Stability | Description |
|---------|-----------|-------------|
| `@hrkit/coach` | 🧪 Experimental | Rule-engine summaries + LLM adapters |
| `@hrkit/ai` | 🧪 Experimental | Agentic training planner with guardrails |
| `@hrkit/ml` | 🧪 Experimental | Pluggable ML inference port — **early stage** |
| `@hrkit/readiness` | 🧪 Experimental | Adaptive HRV baseline + recovery scoring |

### Export & Integration

| Package | Stability | Description |
|---------|-----------|-------------|
| `@hrkit/integrations` | 🧪 Experimental | FIT/TCX export + Strava/Garmin uploaders — **early stage** |
| `@hrkit/cli` | 🧪 Experimental | CLI tools: simulate, sign, verify |

### UI

| Package | Stability | Description |
|---------|-----------|-------------|
| `@hrkit/widgets` | 🧪 Experimental | Live dashboard Web Components |

---

## Deprecations

| Symbol | Package | Replacement | Removal target |
|--------|---------|-------------|----------------|
| *None currently* | — | — | — |

:::note
No public APIs are currently deprecated. When deprecations occur, they will be announced in the [CHANGELOG](https://github.com/josedab/hrkit/blob/main/CHANGELOG.md) and listed here with a migration path.
:::

---

## How we promote APIs

An experimental API is promoted to stable when it meets all of these criteria:

1. **Test coverage** — comprehensive unit and integration tests
2. **Real-world usage** — used in at least one reference app or integration
3. **API stability** — no breaking changes for at least 2 minor releases
4. **Documentation** — complete JSDoc with `@param`, `@returns`, `@example`
5. **Review** — approved by at least one core maintainer

To request promotion of an experimental API, [open an issue](https://github.com/josedab/hrkit/issues/new?template=feature_request.md) with the `api-stability` label.
