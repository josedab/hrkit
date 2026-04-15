# @hrkit — BLE Heart Rate SDK

A platform-agnostic TypeScript SDK for BLE heart rate sensors. Works with any standard BLE HR device. Polar devices with PMD support unlock ECG and accelerometer streaming.

## Packages

| Package | Description |
|---------|-------------|
| `@hrkit/core` | Zero-dependency core: types, GATT parser, HRV metrics, zones, TRIMP, SessionRecorder |
| `@hrkit/polar` | Polar PMD protocol: ECG + accelerometer for H10, H9, OH1, Verity Sense |
| `@hrkit/react-native` | BLE adapter for `react-native-ble-plx` |
| `@hrkit/web` | BLE adapter for Web Bluetooth API |

## Quick Start

```typescript
import { SessionRecorder, connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
```

## Development

```bash
pnpm install
pnpm test        # run tests
pnpm build       # build all packages
```

## Architecture

The BLE transport is injected, so the core works on any runtime. Platform-specific adapters implement the `BLETransport` interface.

```
@hrkit/core (pure TS, zero deps)
  ├── @hrkit/polar (Polar PMD protocol)
  ├── @hrkit/react-native (RN adapter)
  └── @hrkit/web (Web Bluetooth adapter)
```
