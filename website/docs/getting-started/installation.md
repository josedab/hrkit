---
sidebar_position: 2
title: Installation
description: Choose the right packages for your platform and use case.
---

# Installation

@hrkit is a modular SDK. Install only what you need.

## Pick your packages

| I want to…                              | Install                                  |
|------------------------------------------|------------------------------------------|
| Use HR metrics in a React Native app     | `@hrkit/core` + `@hrkit/react-native`    |
| Use HR metrics in a browser app          | `@hrkit/core` + `@hrkit/web`             |
| Use HR metrics in a Capacitor app        | `@hrkit/core` + `@hrkit/capacitor` (or `@hrkit/capacitor-native`) |
| Bridge ANT+ sensors                      | `@hrkit/core` + `@hrkit/ant`             |
| Parse Polar PMD protocol frames          | `@hrkit/core` + `@hrkit/polar`           |
| Stream HR data to WebSocket/SSE clients  | `@hrkit/core` + `@hrkit/server`          |
| Sync sessions across devices (CRDT)      | `@hrkit/core` + `@hrkit/sync`            |
| Export to FIT/TCX or upload to Strava/Garmin/Intervals/TrainingPeaks | `@hrkit/core` + `@hrkit/integrations` |
| Add live HR dashboard widgets            | `@hrkit/widgets`                         |
| Score readiness from session history     | `@hrkit/core` + `@hrkit/readiness`       |
| Run on Cloudflare Workers / Deno / Bun   | `@hrkit/core` + `@hrkit/edge`            |
| Sign & verify conformance bundles        | `@hrkit/core` + `@hrkit/bundle`          |
| Add LLM-powered coaching summaries       | `@hrkit/core` + `@hrkit/coach`           |
| Generate next-week training plans (AI)   | `@hrkit/core` + `@hrkit/ai` + `@hrkit/coach` |
| Run pluggable ML inference (BYO runtime) | `@hrkit/core` + `@hrkit/ml`              |
| Add OpenTelemetry instrumentation        | `@hrkit/core` + `@hrkit/otel`            |
| Use the simulate / sign / verify CLI     | `@hrkit/cli`                             |
| Prototype/test without BLE hardware      | `@hrkit/core` (includes `MockTransport`) |
| Build a custom platform adapter          | `@hrkit/core` (implement `BLETransport`) |

## Core (required)

```bash
npm install @hrkit/core
# or
pnpm add @hrkit/core
# or
yarn add @hrkit/core
```

`@hrkit/core` has **zero runtime dependencies**. It includes:

- GATT Heart Rate parser
- HRV metrics (RMSSD, SDNN, pNN50)
- 5-zone HR calculator and zone distribution
- Bannister TRIMP
- Artifact filter
- Session recorder with round tracking
- `MockTransport` for testing
- `GENERIC_HR` device profile

## React Native

```bash
npm install @hrkit/core @hrkit/react-native react-native-ble-plx
```

`react-native-ble-plx` (>= 2.0.0) is a peer dependency.

**iOS** — Add to `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to heart rate sensors.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to heart rate sensors.</string>
```

**Android** — Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

On Android 12+, you must also request runtime permissions before scanning.

See the [React Native guide](../guides/react-native) for full setup instructions.

## Web Bluetooth

```bash
npm install @hrkit/core @hrkit/web
```

Web Bluetooth requires:
- HTTPS or `localhost`
- A user gesture to trigger the device picker
- A supported browser (Chrome, Edge, Opera — not Firefox or Safari)

See the [Web Bluetooth guide](../guides/web-bluetooth) for details and browser compatibility.

## Polar PMD Protocol

```bash
npm install @hrkit/core @hrkit/polar
```

Adds device profiles and protocol utilities for Polar H10, H9, OH1, and Verity Sense. Enables raw ECG streaming (130Hz) and accelerometer data.

See the [Polar devices guide](../guides/polar-devices) for usage.

## Streaming Server

```bash
npm install @hrkit/server
```

Broadcasts HR data to WebSocket and SSE clients. For WebSocket support, also install `ws`:

```bash
npm install ws
```

See the [@hrkit/server README](https://github.com/josedab/hrkit/tree/main/packages/server) for configuration.

## Capacitor (iOS + Android)

Two Capacitor adapters are available, depending on whether you want a third-party BLE plugin or the bundled native plugin.

```bash
# Community plugin route — broader hardware support, more deps
npm install @hrkit/core @hrkit/capacitor @capacitor-community/bluetooth-le

# Native route — direct CoreBluetooth / android.bluetooth, zero JS BLE deps
npm install @hrkit/core @hrkit/capacitor-native
```

See the corresponding package READMEs for the iOS / Android permission entries.

## ANT+ sensors

```bash
npm install @hrkit/core @hrkit/ant ant-plus-next
```

Wraps `ant-plus-next` so power, cadence and HR sensors expose the same `BLETransport` shape that `@hrkit/core` consumes — letting you mix BLE and ANT+ devices behind one API.

## Sync (CRDT)

```bash
npm install @hrkit/core @hrkit/sync
```

Local-first append-only CRDT log with pluggable `SyncStore` (in-memory, IndexedDB) and `SyncTransport` (WebSocket, in-process pair). Zero runtime dependencies. See the [@hrkit/sync README](https://github.com/josedab/hrkit/tree/main/packages/sync).

## Integrations & file formats

```bash
npm install @hrkit/core @hrkit/integrations
```

FIT / TCX / HealthKit-style exports plus first-class uploaders for Strava (OAuth 2.0), Garmin (partner-program), Intervals.icu (API key) and TrainingPeaks (OAuth 2.0). All uploaders share a `SessionUploader` interface and a structured `UploadResult`.

## AI, coach & readiness

```bash
# Rule-engine summaries + LLM adapters (OpenAI / Anthropic / Ollama)
npm install @hrkit/core @hrkit/coach

# Agentic next-week planner (depends on @hrkit/coach for the LLM provider)
npm install @hrkit/core @hrkit/coach @hrkit/ai

# Adaptive HRV baseline + multi-factor recovery scoring
npm install @hrkit/core @hrkit/readiness
```

## Edge runtimes

```bash
npm install @hrkit/core @hrkit/edge
```

Runtime-portable HR ingestion for Cloudflare Workers / Deno / Bun — no Node-specific APIs. See the [@hrkit/edge README](https://github.com/josedab/hrkit/tree/main/packages/edge).

## Bundle signing

```bash
npm install @hrkit/core @hrkit/bundle
```

Sign & verify conformance bundles via Web Crypto ECDSA P-256. The signing key never leaves your environment; the public key is embedded in the signature payload for verification.

## ML inference

```bash
npm install @hrkit/core @hrkit/ml
```

Pluggable `InferencePort` + model registry. Bring your own runtime (ONNX Runtime, TensorFlow.js, ML Kit) by implementing the port — no runtime is bundled.

## OpenTelemetry hooks

```bash
npm install @hrkit/core @hrkit/otel
```

Zero-dependency instrumentation hooks. Wire them into your existing `@opentelemetry/api` setup; the package itself ships no OTel dependency.

## CLI

```bash
npm install -g @hrkit/cli
hrkit help
```

Subcommands: `simulate` (boots an HTTP server with `/health` / `/profile.json` / `/stream` SSE), `submit-fixture`, `keygen`, `sign`, `verify`.

## Dashboard Widgets

```bash
npm install @hrkit/widgets
```

Zero-dependency Web Components for live HR display: `<hrkit-heart-rate>`, `<hrkit-zone-bar>`, `<hrkit-hr-chart>`. Works in any framework or plain HTML.

See the [@hrkit/widgets README](https://github.com/josedab/hrkit/tree/main/packages/widgets) for usage.

## Requirements

- **Node.js** >= 18
- **TypeScript** >= 5.0 (recommended)
- **ESM** — All packages ship as ES modules
