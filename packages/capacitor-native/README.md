# @hrkit/capacitor-native

A first-class Capacitor 6/7 plugin that talks **directly** to CoreBluetooth (iOS) and `android.bluetooth` (Android) — no `@capacitor-community/bluetooth-le` runtime dependency.

Use this when you need lower-level control than the community plugin offers (custom MTU, vendor-specific services like Polar PMD, multiple simultaneous device subscriptions). For everything else, prefer [`@hrkit/capacitor`](../capacitor).

## Install

```bash
pnpm add @hrkit/capacitor-native @capacitor/core
npx cap sync
```

The native sources are auto-linked via the `capacitor` block in `package.json`.

### iOS

Add `NSBluetoothAlwaysUsageDescription` to `Info.plist`. Minimum deployment target: iOS 14.

### Android

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

Min SDK: 26.

## Usage

```ts
import { createCapacitorNativeTransport } from '@hrkit/capacitor-native';
import { GENERIC_HR_PROFILE, scan, recordSession } from '@hrkit/core';

const transport = await createCapacitorNativeTransport();

for await (const dev of transport.scan([GENERIC_HR_PROFILE])) {
  console.log('Found', dev.name, dev.id);
  break;
}
```

## Plugin contract

| Method | Description |
|--------|-------------|
| `startScan({ services?, timeoutMs? })` | Start LE scan. |
| `stopScan()` | Stop LE scan. |
| `connect({ deviceId })` → `{ deviceId, name }` | GATT connect. |
| `disconnect({ deviceId })` | Disconnect. |
| `startNotifications({ deviceId, service, characteristic })` | Subscribe to a characteristic. |
| `stopNotifications(...)` | Unsubscribe. |
| `addListener(event, cb)` | `'scanResult' \| 'gattNotification' \| 'connectionStateChange'` |

Native events:

```jsonc
// scanResult
{ "deviceId": "AA:BB:CC:DD:EE:FF", "name": "Polar H10", "rssi": -52 }
// gattNotification
{ "deviceId": "...", "service": "180D", "characteristic": "2A37", "hex": "104b0004" }
// connectionStateChange
{ "deviceId": "...", "connected": true }
```

## Why this exists

The community plugin is excellent for HR-only workflows. This package is for cases where you need:

- Direct PMD support without writing your own JS shim
- Per-device MTU negotiation
- Notifications across multiple services in parallel without head-of-line blocking
- A package surface you control (no community release cadence dependency)
