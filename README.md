# @hrkit — BLE Heart Rate SDK

A platform-agnostic TypeScript SDK for BLE heart rate sensors. Works with **any** standard BLE HR device (Polar, Garmin, Wahoo, Magene, generic straps). Polar devices with PMD support unlock additional protocol-level capabilities for ECG and accelerometer data parsing.

> **Try without hardware:** the SDK includes `MockTransport` for testing and prototyping — no BLE device required. See [Try Without Hardware](#try-without-hardware).

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@hrkit/core`](packages/core/) | Zero-dependency core: GATT parser, HRV metrics, zones, TRIMP, SessionRecorder | [README](packages/core/README.md) |
| [`@hrkit/polar`](packages/polar/) | Polar PMD protocol utilities: ECG + accelerometer command builders and parsers | [README](packages/polar/README.md) |
| [`@hrkit/react-native`](packages/react-native/) | BLE adapter for `react-native-ble-plx` | [README](packages/react-native/README.md) |
| [`@hrkit/web`](packages/web/) | BLE adapter for Web Bluetooth API | [README](packages/web/README.md) |
| [`apps/bjj`](apps/bjj/) | Reference BJJ rolling intensity app | [README](apps/bjj/README.md) |

## Architecture

```mermaid
graph TD
    CORE["@hrkit/core<br/><i>zero deps · pure TS</i>"]
    POLAR["@hrkit/polar<br/><i>PMD protocol utilities</i>"]
    RN["@hrkit/react-native<br/><i>react-native-ble-plx</i>"]
    WEB["@hrkit/web<br/><i>Web Bluetooth API</i>"]
    BJJ["apps/bjj<br/><i>reference app</i>"]

    POLAR -->|depends on| CORE
    RN -->|depends on| CORE
    WEB -->|depends on| CORE
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
pnpm lint             # type-check all packages (tsc --noEmit)
pnpm build            # build all packages (tsup, ESM output)
pnpm clean            # remove dist/ in all packages
```

## License

MIT
