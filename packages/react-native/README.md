# @hrkit/react-native

BLE transport adapter for React Native using [`react-native-ble-plx`](https://github.com/dotintent/react-native-ble-plx).

## Install

```bash
npm install @hrkit/core @hrkit/react-native react-native-ble-plx
# or
pnpm add @hrkit/core @hrkit/react-native react-native-ble-plx
```

`react-native-ble-plx` is a **peer dependency** (>=2.0.0).

## Prerequisites

### iOS

Add to `Info.plist`:

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

On Android 12+, you must also request runtime permissions before scanning.

## Usage

```typescript
import { BleManager } from 'react-native-ble-plx';
import { connectToDevice, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { ReactNativeTransport } from '@hrkit/react-native';

// Create a BleManager instance (typically once, at app startup)
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

## How It Works

`ReactNativeTransport` implements the `BLETransport` interface from `@hrkit/core`:

- **`scan(profiles?)`** — Starts a BLE scan using `BleManager.startDeviceScan()`. Yields discovered `HRDevice` objects as an async iterable. Deduplicates devices by ID. Matches devices against provided profiles by name prefix.
- **`stopScan()`** — Stops the active scan.
- **`connect(deviceId, profile)`** — Connects to a device, discovers services/characteristics, and returns an `HRConnection` that streams `HRPacket` data from the standard GATT Heart Rate Measurement characteristic.

### Scan Behavior

Unlike Web Bluetooth (which shows a modal picker), React Native performs a continuous background scan. The `connectToDevice()` helper from `@hrkit/core` handles the scan → match → connect flow automatically.

### Disconnect Handling

The connection exposes an `onDisconnect` promise that resolves when the device disconnects (either by calling `disconnect()` or losing connection). Use this for cleanup:

```typescript
conn.onDisconnect.then(() => {
  console.log('Device disconnected');
});
```

## API

### `ReactNativeTransport`

```typescript
class ReactNativeTransport implements BLETransport {
  constructor(manager: BleManager);

  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

The constructor accepts a `BleManager` instance from `react-native-ble-plx`. This is injected rather than created internally so you can manage the lifecycle and share it across your app.
