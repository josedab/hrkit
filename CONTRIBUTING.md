# Contributing to @hrkit

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone <repo-url>
cd hrkit
pnpm install    # requires pnpm >= 9, Node >= 22
pnpm test       # run all tests
pnpm lint       # type-check all packages
pnpm check      # lint + format check (biome)
pnpm build      # build all packages
```

## Project Structure

```
packages/
  core/           @hrkit/core — zero-dependency core library
  polar/          @hrkit/polar — Polar PMD protocol utilities
  react-native/   @hrkit/react-native — BLE adapter
  web/            @hrkit/web — BLE adapter
  server/         @hrkit/server — WebSocket + SSE streaming server
  widgets/        @hrkit/widgets — live dashboard Web Components
apps/
  bjj/            Reference app (uses MockTransport)
  starter-rn/     React Native starter template
```

**Dependency graph:** `core` has zero runtime deps. `polar`, `react-native`, `web`, and `server` depend on `core` via `workspace:*`. `widgets` is standalone.

## Architecture Notes

- **All core functions are pure.** No classes (except `SessionRecorder`), no state, no platform imports. This makes them trivially testable.
- **BLE transport is injected.** `BLETransport` is an interface; platform adapters implement it. `MockTransport` is the test implementation.
- **Device capability model.** Devices are described by `DeviceProfile` objects declaring capabilities. Consumer code requests capabilities, not specific devices.
- **Workspace resolution for tests.** Vitest uses path aliases in `vitest.config.ts` to resolve `@hrkit/core` and `@hrkit/polar` to source (not dist). Tests always run against source code.
- **Web package needs separate type-check.** The `@hrkit/web` package requires DOM types, so it has its own `tsconfig.lint.json` and is checked separately in the `lint` script.

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
