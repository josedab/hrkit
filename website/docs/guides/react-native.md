---
sidebar_position: 4
title: React Native Setup
description: Full setup guide for using @hrkit with React Native and react-native-ble-plx.
---

# React Native Setup

This guide covers setting up `@hrkit/react-native` in a React Native project with `react-native-ble-plx`.

## Install

```bash
npm install @hrkit/core @hrkit/react-native react-native-ble-plx
```

`react-native-ble-plx` (>= 2.0.0) is a peer dependency.

For iOS, install pods:

```bash
cd ios && pod install
```

## Platform permissions

### iOS

Add to your `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to heart rate sensors.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to heart rate sensors.</string>
```

### Android

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

On Android 12+, request runtime permissions before scanning:

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

async function requestBLEPermissions() {
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(
      (r) => r === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}
```

## Usage

```typescript
import { BleManager } from 'react-native-ble-plx';
import { connectToDevice, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { ReactNativeTransport } from '@hrkit/react-native';

// Create a BleManager once at app startup
const bleManager = new BleManager();
const transport = new ReactNativeTransport(bleManager);

// Connect to the first HR device found
const conn = await connectToDevice(transport, {
  prefer: [GENERIC_HR],
  timeoutMs: 15000,
});

console.log('Connected:', conn.deviceName);

// Record session
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
```

## Scan behavior

Unlike Web Bluetooth (which shows a modal picker), React Native performs a **continuous background scan**. The `connectToDevice()` helper handles the scan → match → connect flow automatically.

Devices are:
- Deduplicated by ID
- Matched against provided profiles by name prefix
- Connected to the first match (or best match from preferred profiles)

## Disconnect handling

Listen for disconnects to update your UI:

```typescript
conn.onDisconnect.then(() => {
  console.log('Device disconnected');
  // Show reconnect UI
});

// Or explicitly disconnect
await conn.disconnect();
```

## Tips

- **Create `BleManager` once** — Inject it into `ReactNativeTransport` so you control its lifecycle and can share it across your app.
- **Handle permissions early** — Check and request BLE permissions before showing the connect UI.
- **Use `timeoutMs`** — Set a scan timeout to avoid indefinite scanning if no device is nearby.
