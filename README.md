# @hrkit — BLE Heart Rate SDK

[![CI](https://github.com/josedab/hrkit/actions/workflows/ci.yml/badge.svg)](https://github.com/josedab/hrkit/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/) [![codecov](https://codecov.io/gh/josedab/hrkit/branch/main/graph/badge.svg)](https://codecov.io/gh/josedab/hrkit)

A platform-agnostic TypeScript SDK for BLE heart rate sensors. Works with **any** standard BLE HR device (Polar, Garmin, Wahoo, Magene, generic straps). Polar devices with PMD support unlock additional protocol-level capabilities for ECG and accelerometer data parsing.

> **Try without hardware:** the SDK includes `MockTransport` for testing and prototyping — no BLE device required. See [Try Without Hardware](#try-without-hardware).

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@hrkit/core`](packages/core/) | Zero-dependency core: GATT parser, HRV, zones, TRIMP, session recording, analysis, serialization, streaming metrics | [README](packages/core/README.md) |
| [`@hrkit/polar`](packages/polar/) | Polar PMD protocol utilities: ECG + accelerometer command builders and parsers | [README](packages/polar/README.md) |
| [`@hrkit/react-native`](packages/react-native/) | BLE adapter for `react-native-ble-plx` | [README](packages/react-native/README.md) |
| [`@hrkit/web`](packages/web/) | BLE adapter for Web Bluetooth API | [README](packages/web/README.md) |
| [`@hrkit/server`](packages/server/) | Streaming HR data server: WebSocket and SSE broadcasting | [README](packages/server/README.md) |
| [`@hrkit/widgets`](packages/widgets/) | Live dashboard Web Components: heart rate gauge, zone bar, HR chart | [README](packages/widgets/README.md) |

## Architecture

```mermaid
graph TD
    CORE["@hrkit/core<br/><i>zero deps · pure TS</i>"]
    POLAR["@hrkit/polar<br/><i>PMD protocol utilities</i>"]
    RN["@hrkit/react-native<br/><i>react-native-ble-plx</i>"]
    WEB["@hrkit/web<br/><i>Web Bluetooth API</i>"]
    SERVER["@hrkit/server<br/><i>WebSocket + SSE</i>"]
    WIDGETS["@hrkit/widgets<br/><i>Web Components</i>"]
    BJJ["apps/bjj<br/><i>reference app</i>"]

    POLAR -->|depends on| CORE
    RN -->|depends on| CORE
    WEB -->|depends on| CORE
    SERVER -->|depends on| CORE
    BJJ -->|depends on| CORE
    BJJ -->|depends on| POLAR
```

BLE transport is **injected** — the core runs on any runtime. Platform adapters implement the [`BLETransport`](packages/core/README.md#bletransport) interface. The runtime data flow is:

```
BLE adapter → HRConnection → HRPacket → SessionRecorder → Session → metrics
```

## What to Install

| I want to…                              | Install                                  |
|------------------------------------------|------------------------------------------|
| Use HR metrics in a React Native app     | `@hrkit/core` + `@hrkit/react-native`    |
| Use HR metrics in a browser app          | `@hrkit/core` + `@hrkit/web`             |
| Parse Polar PMD protocol frames          | `@hrkit/core` + `@hrkit/polar`           |
| Stream HR data to WebSocket/SSE clients  | `@hrkit/core` + `@hrkit/server`          |
| Add live HR dashboard widgets            | `@hrkit/widgets`                         |
| Prototype/test without BLE hardware      | `@hrkit/core` (includes `MockTransport`) |
| Build a custom platform adapter          | `@hrkit/core` (implement `BLETransport`) |

## Quick Start

### Connect to any BLE HR sensor

```typescript
import { SessionRecorder, connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

// Replace with ReactNativeTransport or WebBluetoothTransport for real BLE
const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
```

### One-Call Session Analysis

```typescript
import { analyzeSession } from '@hrkit/core';

const analysis = analyzeSession(session);
console.log(`TRIMP: ${analysis.trimp}`);
console.log(`RMSSD: ${analysis.hrv?.rmssd}`);
console.log(`Zone 5 time: ${analysis.zones.zones[5]}s`);
```

### Save & Load Sessions

```typescript
import { sessionToJSON, sessionFromJSON, sessionToTCX } from '@hrkit/core';

// Persist to storage
const json = sessionToJSON(session);
localStorage.setItem('session', json);

// Load back
const restored = sessionFromJSON(localStorage.getItem('session')!);

// Export for Strava/Garmin
const tcx = sessionToTCX(session, { sport: 'Running' });
```

### Prefer Polar H10, fall back to any device

```typescript
import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { POLAR_H10, isPolarConnection } from '@hrkit/polar';

const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10],
  fallback: GENERIC_HR,
});

// Standard HR works on every device
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// ECG capability check (Polar PMD protocol utilities available)
if (isPolarConnection(conn) && conn.profile.capabilities.includes('ecg')) {
  console.log('Connected to a Polar device with ECG support');
}
```

### Try Without Hardware

```typescript
import { SessionRecorder, connectToDevice, MockTransport } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const transport = new MockTransport({
  device: { id: 'test', name: 'Mock HR Strap' },
  packets: [
    { timestamp: 0,    hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 1000, hr: 78, rrIntervals: [769], contactDetected: true },
    { timestamp: 2000, hr: 85, rrIntervals: [706], contactDetected: true },
  ],
});

const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
console.log(`Recorded ${session.samples.length} samples`);
```

For a full example, run the BJJ reference app:

```bash
cd apps/bjj && npx tsx src/index.ts
```

## Key Concepts

### Device Profiles

Devices are described by `DeviceProfile` objects that declare capabilities. Consumer code requests capabilities, not specific devices:

```typescript
type Capability = 'heartRate' | 'rrIntervals' | 'ecg' | 'accelerometer';

interface DeviceProfile {
  brand: string;
  model: string;
  namePrefix: string;        // used for BLE scan filtering
  capabilities: Capability[];
  serviceUUIDs: string[];
}
```

Built-in profiles: `GENERIC_HR` (core), `POLAR_H10`, `POLAR_H9`, `POLAR_OH1`, `POLAR_VERITY_SENSE` (polar). You can also [define custom profiles](packages/core/README.md#custom-device-profiles).

### Capability Gating

The SDK is designed for graceful degradation. Standard HR features work on every device. Advanced capabilities (ECG, accelerometer) activate only on supported hardware:

```typescript
// Works on every BLE HR device
for await (const packet of conn.heartRate()) { /* ... */ }

// Only available on Polar devices with PMD support
if (isPolarConnection(conn) && conn.profile.capabilities.includes('ecg')) {
  // Polar-specific features
}
```

## Development

```bash
pnpm install          # install all dependencies
pnpm test             # run tests (vitest)
pnpm test:watch       # run tests in watch mode
pnpm test:coverage    # run tests with coverage report
pnpm lint             # type-check all packages (tsc --noEmit)
pnpm format           # auto-format all files (biome)
pnpm check            # lint + format check (biome)
pnpm build            # build all packages (tsup, ESM output)
pnpm clean            # remove dist/ in all packages
pnpm size             # check bundle sizes
pnpm changeset        # create a changeset for versioning
```

## License

MIT
