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
| Parse Polar PMD protocol frames          | `@hrkit/core` + `@hrkit/polar`           |
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

## Requirements

- **Node.js** >= 18
- **TypeScript** >= 5.0 (recommended)
- **ESM** — All packages ship as ES modules
