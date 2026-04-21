# Contributing to @hrkit

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/josedab/hrkit.git
cd hrkit
pnpm install    # requires pnpm >= 9, Node >= 18
pnpm test       # run all tests
pnpm lint       # type-check all packages
pnpm check      # lint + format check (biome)
pnpm build      # build all packages
```

## Project Structure

```
packages/
  core/             @hrkit/core             — Zero-dep core (GATT parser, HRV, zones, TRIMP, session, analysis, plugins)
  polar/            @hrkit/polar            — Polar PMD protocol (ECG + ACC), depends on core
  ant/              @hrkit/ant              — ANT+ heart-rate adapter
  react-native/     @hrkit/react-native     — BLE adapter for react-native-ble-plx
  web/              @hrkit/web              — BLE adapter for Web Bluetooth API
  capacitor/        @hrkit/capacitor        — Capacitor Web Bluetooth adapter
  capacitor-native/ @hrkit/capacitor-native — Capacitor native BLE adapter
  server/           @hrkit/server           — WebSocket + SSE streaming server
  widgets/          @hrkit/widgets          — Live dashboard Web Components
  bundle/           @hrkit/bundle           — Conformance bundle signing (Web Crypto ECDSA)
  cli/              @hrkit/cli              — Command-line tools (simulate, sign, verify)
  ai/               @hrkit/ai              — Agentic training planner + prompt helpers
  coach/            @hrkit/coach           — Coaching cues + LLM adapters
  edge/             @hrkit/edge            — Edge-runtime / Workers compatibility
  integrations/     @hrkit/integrations    — FIT/TCX export + Strava/Garmin uploaders
  ml/               @hrkit/ml              — Pluggable ML inference port + model registry
  otel/             @hrkit/otel            — OpenTelemetry instrumentation hooks
  readiness/        @hrkit/readiness       — Adaptive HRV baseline + recovery scoring
  sync/             @hrkit/sync            — Local-first CRDT sync + IndexedDB store
apps/
  bjj/              Reference BJJ rolling intensity app (uses MockTransport)
  cloud-api/        Cloud-side API service that ingests sync uploads
  dashboard/        Live dashboard Vite app built on widgets
  demo/             General SDK demo / sandbox
  starter-rn/       React Native starter source template
  starter-web/      Web starter template
```

**Dependency graph:** `core` has zero runtime deps. Adapters (`polar`, `ant`, `react-native`, `web`, `capacitor`, `capacitor-native`), platform packages (`server`, `cli`, `bundle`, `edge`, `otel`), and feature packages (`coach`, `ai`, `readiness`, `sync`, `integrations`, `ml`) depend on `core` via `workspace:*`. `widgets` is standalone.

## Architecture Notes

- **All core functions are pure.** Pure analysis helpers (HRV, zones, TRIMP, artifact filter, GATT parser, VO2max, stress, AFib screening) have no state and no platform imports. Stateful behavior is encapsulated in classes — `SessionRecorder`, `MultiDeviceManager`, `GroupSession`, `WorkoutEngine`, `WorkoutCues`, `RealtimeArtifactDetector`, `RollingRMSSD`, `TRIMPAccumulator`, `PluginRegistry`, `InMemoryAthleteStore`, `SensorFusion`, `SensorBus`, `SessionPlayer`, `PlanRunner`, `MemoryGlucoseSource`, and `MockTransport`.
- **BLE transport is injected.** `BLETransport` is an interface; platform adapters implement it. `MockTransport` is the test implementation.
- **Device capability model.** Devices are described by `DeviceProfile` objects declaring capabilities. Consumer code requests capabilities, not specific devices.
- **Workspace resolution for tests.** Vitest uses path aliases in `vitest.config.ts` to resolve every `@hrkit/*` package to its source (not dist). Tests always run against source code.
- **Per-package type-check.** `pnpm lint` runs `pnpm -r --parallel run typecheck` so every package's `typecheck` script is invoked. Packages that need DOM (`web`, `widgets`) or Node (`server`) types declare their own `tsconfig.lint.json`. To add a new package, give it a `typecheck` script in `package.json`.

## Key Design Decisions

- **RR interval conversion:** Raw BLE values are in 1/1024s units. Multiply by `1000/1024` (not 1000). See `gatt-parser.ts`.
- **Observable pattern:** `SessionRecorder.hr$` and `zone$` use BehaviorSubject-like semantics (emit current value on subscribe). Implemented as a minimal `SimpleStream` — no rxjs dependency.
- **TRIMP formula:** Bannister's method with sex-based exponential weighting (male=1.92, female=1.67, neutral=1.80).
- **Readiness thresholds:** `todayRmssd/baseline >= 0.95` → go_hard, `>= 0.80` → moderate, `< 0.80` → rest.
- **MockTransport accepts in-memory data**, not file paths. No file system dependency in the SDK.
- **Gap handling:** Both `zoneDistribution` and `trimp` skip sample intervals > 30 seconds to avoid distorting metrics during data gaps.

## Making Changes

1. **Fork & branch** from `main`.
2. **Write tests first** — tests live alongside source in `packages/*/src/__tests__/`.
3. **Keep core zero-dependency** — no runtime dependencies in `@hrkit/core`.
4. **Run checks** before submitting:
   ```bash
   pnpm test && pnpm lint && pnpm check && pnpm build
   ```
5. **Create a changeset** if your change affects published packages:
   ```bash
   pnpm changeset
   ```
6. **Open a PR** with a clear description of the change.

## Adding a new package

To keep the monorepo consistent, every workspace package under `packages/` should:

1. Have a `tsconfig.lint.json` extending the root `tsconfig.json` (lean, no `rootDir`/`outDir`, `noEmit: true`). Override `lib` (e.g. `["ES2022", "DOM"]`) or `types` (e.g. `["node"]`) as needed.
2. Expose a `typecheck` script in `package.json`: `"typecheck": "tsc --noEmit -p tsconfig.lint.json"`. Root `pnpm lint` runs this for every package in parallel via `pnpm -r --parallel run typecheck` — packages without the script are silently skipped, so don't forget it.
3. Add a vitest alias in `vitest.config.ts` so tests resolve to source, not `dist`.
4. Add a `size-limit` entry in the root `package.json` if the package is published.
5. Add a README entry in the root `README.md` "Packages" table and Mermaid diagram.

## Code Style

- TypeScript strict mode throughout.
- Pure functions preferred — no classes unless state is required.
- No `any` types.
- Use `camelCase` for functions, `PascalCase` for classes/types, `SCREAMING_SNAKE_CASE` for constants.
- Formatting is enforced by [Biome](https://biomejs.dev/). Run `pnpm format` to auto-fix.

## Testing

Tests live alongside source in `packages/*/src/__tests__/`. Fixture data is in `packages/core/src/__tests__/fixtures/`.

Test categories:
- **Pure function tests** (HRV, zones, TRIMP, artifact filter) — no mocking needed
- **GATT parser tests** — construct DataView bytes, verify parsing
- **PMD parser tests** — construct binary frames, verify ECG/ACC decoding
- **Integration tests** — full scan → connect → record → analyze workflow via MockTransport

Run a single test file:
```bash
npx vitest run packages/core/src/__tests__/hrv.test.ts
```

## Debugging

The SDK ships with a pluggable logger (`@hrkit/core`) that defaults to no-op (silent). To enable debug output:

```typescript
import { setLogger, ConsoleLogger } from '@hrkit/core';

// Enable all SDK log output to the console (with PII redaction)
setLogger(ConsoleLogger);
```

For a custom logger (pino, winston, etc.), implement the `Logger` interface:

```typescript
import { setLogger, type Logger } from '@hrkit/core';

const myLogger: Logger = {
  debug: (msg, meta) => pino.debug(meta, msg),
  info:  (msg, meta) => pino.info(meta, msg),
  warn:  (msg, meta) => pino.warn(meta, msg),
  error: (msg, meta) => pino.error(meta, msg),
};
setLogger(myLogger);
```

Key points:
- All log output is routed through `redact()` before emission — API keys, tokens, and signed URLs are masked automatically.
- Call `setLogger(NoopLogger)` to silence the SDK again.
- The logger is global — set it once at app startup.
- See `packages/core/src/logger.ts` for the full interface and `packages/core/src/__tests__/logger.test.ts` for usage examples.

## Adding a Device Profile

To add support for a new BLE HR device, create a `DeviceProfile` object:

```typescript
import { DeviceProfile, GATT_HR_SERVICE_UUID } from '@hrkit/core';

export const MY_DEVICE: DeviceProfile = {
  brand: 'MyBrand',
  model: 'MyModel',
  namePrefix: 'MyDevice',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
```

## Reporting Issues

Please include:
- SDK version and package (`@hrkit/core`, `@hrkit/web`, etc.)
- Platform (browser, React Native, Node.js)
- Steps to reproduce
- Expected vs actual behavior
