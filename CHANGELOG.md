# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`@hrkit/sync` `CrdtLog.compact(beforeLamport)`**: prune entries below a Lamport cutoff for storage-bound consumers; preserves the local clock.
- **`@hrkit/sync` `CrdtLog.cursors()` / `sinceCursors(map)`**: per-replica high-water mark map and the matching delta filter.
- **`@hrkit/sync` `SyncEngine.cursors()`**: inspection helper exposing what `hello` would advertise.
- **`@hrkit/sync` `SyncEngine` persistence options**: optional `{ store, logger, autoPrune }` constructor argument. Saves are coalesced; `autoPrune.maxEntries` caps snapshot size after each persist by compacting the oldest entries first.
- **`@hrkit/sync` `SyncEngine.flush()`**: returns the in-flight persist promise.
- **`@hrkit/sync` `ReconnectingWebSocketSyncTransport`**: WebSocket transport with exponential backoff + jitter, bounded outbound buffer, and `hrkit.sync.send_dropped` warnings on overflow.
- **`@hrkit/sync` `WebSocketSyncTransport` logger option**: explicit warn-and-drop on `CLOSING`/`CLOSED` sockets instead of silently leaking listeners.
- **`@hrkit/sync` `DisposableSyncStore`**: `createIndexedDBStore` now returns one and caches the underlying `IDBDatabase`; new `close()` releases it.
- **`@hrkit/sync` `SYNC_WIRE_VERSION` export + `SyncMessage.v` field**: every outbound message carries `v: 1`. Lets future receivers detect version skew; absent `v` is treated as legacy v0.
- **`@hrkit/sync` `createMockTransportPair`**: in-memory paired transports with optional `dropRate`/`latencyMs` for testing user integrations without WebSockets.
- **`@hrkit/integrations` README**: documents structured `UploadResult` (`code`/`httpStatus`/`requestId`/`retryAfterSeconds`), `summarizeUploads` fan-out helper, and the reliability primitives (retries, idempotency keys, timeouts, cancellation, token refresh).
- **`@hrkit/sync` `SyncEngine.gaps()`**: convenience proxy to `CrdtLog.gaps()` so callers only need to hold the engine reference for observability hooks.
- **`@hrkit/sync` `CrdtLog.gaps()`**: per-replica missing lamports between the contiguous high-water mark and the sparse maximum. Empty `{}` when nothing is missing. Useful for surfacing convergence stalls in observability.
- **`@hrkit/server` README**: documents `InMemoryRoomStore` / `joinRoom` / `applyPacketToRoom` / `snapshotRoom` for multi-tenant group classes, and `SignalingRoom` / `WebRTCBroadcaster` for peer-to-peer WebRTC fan-out.
- **`@hrkit/coach` README**: rewritten end-to-end to match actual exports (`ruleEngineSummary`, `generateCoachSummary`, `OpenAIProvider` / `AnthropicProvider` / `OllamaProvider`, `liveCue`, the three built-in recommenders + `evalRecommender`, `LLMProvider` / `RecommenderPort` interfaces, `sessionRmssd` re-export).
- **`@hrkit/otel` README**: rewritten — the package has zero deps and ships its own `InstrumentationHooks` interface (no `@opentelemetry/api` peer-dep). Documents `wrapTransport` / `recordHrSample` / `MemoryHooks` / `NOOP_HOOKS` and the full list of emitted spans + metrics with attributes.
- **`@hrkit/edge` README**: rewritten to match actual exports — `createIngestHandler`, `EdgeStore` / `MemoryStore`, `IngestConfig` / `IngestedSample` / `validateSample`. Documents all four routes, auth/CORS/batch-size knobs, and partial-failure (HTTP 207) semantics.
- **`@hrkit/bundle` README**: rewritten — `signBundle(payload, opts)` (the old example called it with `(payload, privateKey)` which doesn't compile), `verifyBundle` returning a structured `VerifyResult` (not a `boolean`), TOFU vs. `expectedPublicKey` pinning, and the wire-format/failure-mode tables.
- **`@hrkit/ai` README**: rewritten — `planNextWeek({ store, goal, daysAhead?, llm, guardrails? })` matches the actual signature (the old example used a fictional `history` / `readiness` shape). Documents `makeTools` / `buildSnapshot` / `AthleteSnapshot` / `PlanGuardrails` and explains why every emitted DSL is parsed through `@hrkit/core` before being returned.
- **`@hrkit/ml` README**: expanded with usage examples for `ModelRegistry.register` / `get` (latest vs. exact-version), a custom-model template, and tables of the I/O shapes for `lactateThresholdBaseline` and `fatigueBaseline`.
- **`@hrkit/readiness` README**: rewritten — old example used non-existent fields (`bucket`, `rhrDelta`, `baseline` object) and called `updateBaseline` with the wrong shape. New README documents the real `ReadinessInput` (`baselineRmssd` number, `restingHr` + `baselineRestingHr`), `recommendation` field, threshold table, weight-tuning, and per-component output.
- **`@hrkit/ant` README**: rewritten — fixed `ANTTransport` → `AntTransport`, documented the real `AntTransportOptions` shape (`stick`, `channels`, `profileFor`), `loadGarminStick()` helper, `AntStick` / `AntChannel` interfaces, and the four failure modes.
- **`@hrkit/capacitor` README**: documented `scanTimeoutMs`, `androidNeverForLocation`, and `client` injection options (previously undocumented).
- **`@hrkit/capacitor-native` README**: fixed wrong import (`GENERIC_HR_PROFILE` → `GENERIC_HR`) and dropped phantom `scan` / `recordSession` imports; mentioned the `loadNativePlugin()` helper.
- **`@hrkit/cli` README**: rewritten to match the actual binary commands (`simulate` / `submit-fixture` / `keygen` / `sign` / `verify`) — old README referenced nonexistent `replay` / `submit` / `profiles` subcommands. Added the simulate-server endpoint table and a programmatic-API section for `dslToHrProfile` / `encodeHrPacket` / `buildConformanceFixture` / `parseArgv`.
- **`@hrkit/integrations` README**: added per-provider quickstarts (Strava OAuth 2.0 with refresh hook, Garmin partner-program OAuth 1.0a `signHeaders`, Intervals.icu API key, TrainingPeaks OAuth 2.0) and a "File formats & health stores" section documenting `sessionToFIT` / `verifyFIT` / `sessionToTCX` / `sessionToHealthRecords` / `HealthStore` / `MemoryHealthStore` (previously exported but undocumented).
- **Top-level `README.md`**: rewrote the package index — old version listed only 6 of the 20 published packages, hiding `sync`, `integrations`, `coach`, `ai`, `ml`, `readiness`, `bundle`, `cli`, `otel`, `edge`, `ant`, `capacitor` and `capacitor-native`. Grouped by category (core/transports/streaming/integrations/AI/UI), expanded the "What to install" matrix, fixed the `pnpm lint` description (now correctly says "per-package `typecheck` script"), and normalized `GENERIC_HR` imports to the top-level `@hrkit/core` entry.
- **`@hrkit/widgets` README**: documented `<hrkit-ecg-strip>` (raw-ECG strip with R-peak overlay, paired with Polar PMD streams) and `<hrkit-breath-pacer>` (HRV biofeedback animation) — both shipped as exported custom elements but undocumented. Added the `detectRPeaks` Pan-Tompkins R-peak utility, `registerAll()`, `SDK_NAME` and `SDK_VERSION` to the "Exported utilities" section. Updated the package intro and Quick Start example to reflect the full five-component lineup.
- **`apps/cloud-api` README**: rewrote against the actual worker — old version listed wrong routes (`GET /sessions/:athlete` doesn't exist; `/sessions/:athlete/:session` returns sample keys, not NDJSON; `GET /samples/:key` was missing entirely), missed the `/health` endpoint, and showed a `POST /ingest` curl with a single object body when the handler requires an array. Documented the dual auth scheme (`X-Api-Key` KV-backed records with optional athlete pinning, plus the legacy `Authorization: Bearer` fallback), the `free`/`pro` tier model with `HRKIT_FREE_TIER_RPM` / `HRKIT_PRO_TIER_RPM` rate-limit knobs, and the optional `ARCHIVE` R2 binding for sample archival.
- **`apps/starter-rn` README**: expanded the `useHRKit` hook example — old version showed only 5 of the 12 returned values, hiding `isPaused`, `elapsed`, `pauseSession`, `resumeSession`, `startRound` and `endRound`. Added types to the API quick-reference table (`hrToZone({ maxHR, zones })`, `filterArtifacts` returns `{ filtered, artifactRate }`, `analyzeSession` returns `SessionAnalysis`, `connectToDevice` accepts options, added `pnn50`).
- **Docusaurus `getting-started/installation.md`**: same package-index expansion as the top-level README — old install matrix mentioned 6 packages; new one covers Capacitor (community + native), ANT+, sync, integrations, readiness, edge, bundle, coach, ai, ml, otel, cli. Added one short install block per package family with the correct peer-dep tip (`react-native-ble-plx`, `@capacitor-community/bluetooth-le`, `ant-plus-next`, `ws`).
- **Docusaurus `getting-started/quick-start.md`**: normalized `GENERIC_HR` import to `@hrkit/core` (was using the still-supported but inconsistent `@hrkit/core/profiles` subpath).
- **`@hrkit/web` README**: documents the `isWebBluetoothSupported()` runtime detection helper.
- **`@hrkit/react-native` README**: documents the `isBleManagerReady()` preflight helper.
- **`size-limit` budgets**: tightened all 19 package budgets from 5–10× headroom to ~1.3–2× current size so regressions actually get caught (e.g., `@hrkit/sync` 15 kB → 4 kB, `@hrkit/integrations` 20 kB → 4 kB, `@hrkit/web` 5 kB → 3 kB). All budgets continue to pass.
- **`@hrkit/server` README**: documents `maxBufferedBytesPerClient` config and `getSlowClientDrops()` observability method.

### Changed
- **CI/typecheck coverage**: added `typecheck` scripts to `apps/bjj`, `apps/dashboard`, `apps/demo`, `apps/playground`, `apps/starter-web`, and `examples/`. Previously `pnpm lint` only ran on packages — apps and the runnable quickstart could drift out of sync with `@hrkit/core` API changes without CI catching it. Added `@types/node` and `"types": ["node"]` to `examples/tsconfig.json` so the `process.exit` call typechecks. Verified all six newly-covered targets typecheck clean against the current API.
- **`@hrkit/sync` `CrdtLog.cursors()` now returns the *contiguous* high-water mark** per replica (highest `N` such that all lamports `1..N` from that replica are present locally), not the sparse maximum. This makes the cursor handshake self-healing: dropped deltas in the middle of a replica's lamport range are recovered on the next `hello`/`delta` round-trip because the receiver's advertised cursor stops at the gap. The returned shape (`Record<string, number>`) is unchanged. Most callers see no behavior difference; only those who assumed sparse-max semantics need to adjust.
- **`@hrkit/sync` wire format (additive)**: `SyncMessage` gains an optional `cursors?: Record<string, number>` field. `SyncEngine.start()` ships `hello { cursors }` instead of the full snapshot. Peers without `cursors` (legacy v0) still receive the full snapshot in the reply.
- **`@hrkit/sync` `SyncEngine.start()`** now returns `Promise<void>` (was `void`). Existing callers that ignored the return value still work because the function is synchronous when no `store` is configured.

## [0.2.0] - 2026-04-16

### Added
- **Error hierarchy**: `HRKitError`, `ParseError`, `ConnectionError`, `TimeoutError`, `DeviceNotFoundError` for structured error handling.
- **GATT parser bounds checking**: validates DataView length before parsing, throws `ParseError` on truncated data.
- **Session serialization**: `sessionToJSON()`, `sessionFromJSON()`, `sessionToCSV()`, `roundsToCSV()`.
- **Session analysis**: `analyzeSession()` one-call convenience function for post-session metrics.
- **TCX export**: `sessionToTCX()` for Strava/Garmin Connect/TrainingPeaks integration.
- **SessionRecorder enhancements**: `pause()`/`resume()`, `setDeviceInfo()`, `setMetadata()`, packet-based timestamps.
- **Schema versioning**: `schemaVersion` field on Session for forward compatibility.
- **Data validation**: `validateHRPacket()` with configurable HR/RR ranges.
- **Connection management**: `connectWithReconnect()` with exponential backoff and `ConnectionState` observable.
- **Streaming metrics**: `RollingRMSSD` and `TRIMPAccumulator` for real-time windowed HRV and TRIMP.
- **Real-time artifact detection**: `RealtimeArtifactDetector` with `artifacts$` observable stream.
- **Zone presets**: `ZONE_PRESETS` (5-zone, 3-zone) and unified `AthleteProfile` type with `toSessionConfig()`, `toZoneConfig()`, `toTRIMPConfig()`.
- **Re-exported `GENERIC_HR`** from `@hrkit/core` main entry (no longer requires `/profiles` subpath).
- **Adapter crash safety**: both web and react-native adapters wrap `parseHeartRate()` in try-catch.
- **CI pipeline**: GitHub Actions workflow for Node.js 18/20/22 matrix (test, lint, build).
- **MIT LICENSE file**.

### Fixed
- `weeklyTRIMP()` now accepts a `sex` parameter instead of hardcoding `'neutral'`.
- `SessionRecorder` uses packet timestamps instead of `Date.now()` for accurate timing in replay.

### Removed
- Unused `@anthropic-ai/sdk` dev dependency.

## [0.1.0] - 2026-04-16

### Added
- Core GATT HR parser with 1/1024s → ms conversion.
- HRV metrics: `rmssd()`, `sdnn()`, `pnn50()`, `meanHR()`, `hrBaseline()`, `readinessVerdict()`.
- 5-zone HR model with `hrToZone()` and `zoneDistribution()`.
- Bannister's TRIMP with `trimp()` and `weeklyTRIMP()`.
- Artifact filter with remove/interpolate strategies.
- `SessionRecorder` with round tracking and observable streams.
- `connectToDevice()` with prefer/fallback device selection.
- `MockTransport` for testing without BLE hardware.
- Device profiles: `GENERIC_HR`, Polar H10/H9/OH1/Verity Sense.
- `@hrkit/polar` package with PMD protocol parsers.
- `@hrkit/web` adapter for Web Bluetooth API.
- `@hrkit/react-native` adapter for react-native-ble-plx.
