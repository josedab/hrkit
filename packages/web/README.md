# @hrkit/web

BLE transport adapter for the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

## Install

```bash
npm install @hrkit/core @hrkit/web
# or
pnpm add @hrkit/core @hrkit/web
```

## Browser Compatibility

Web Bluetooth is supported in:

- ✅ Chrome (desktop & Android)
- ✅ Edge (desktop)
- ✅ Opera
- ❌ Firefox
- ❌ Safari (iOS & macOS)

Check [Can I Use](https://caniuse.com/web-bluetooth) for current status.

Detect support at runtime before showing a "Connect" button:

```typescript
import { isWebBluetoothSupported } from '@hrkit/web';

if (!isWebBluetoothSupported()) {
  showFallbackUI('Your browser does not support Web Bluetooth.');
}
```

## Important Constraints

- **User gesture required:** `scan()` triggers the browser's device picker dialog and must be called from a user-initiated event handler (click, tap, etc.).
- **Single device selection:** Unlike continuous BLE scanning, Web Bluetooth presents a modal picker. The user selects one device, and `scan()` yields that single device then ends.
- **HTTPS required:** Web Bluetooth only works on secure origins (`https://` or `localhost`).
- **No RSSI during scan:** Web Bluetooth does not expose signal strength in the picker flow. `HRDevice.rssi` is always `0`.

## Usage

```typescript
import { connectToDevice, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { WebBluetoothTransport } from '@hrkit/web';

const transport = new WebBluetoothTransport();

// Must be called from a user gesture handler (e.g., button click)
document.getElementById('connect-btn')!.addEventListener('click', async () => {
  const conn = await connectToDevice(transport, {
    prefer: [GENERIC_HR],
  });

  console.log('Connected:', conn.deviceName);

  const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

  for await (const packet of conn.heartRate()) {
    recorder.ingest(packet);
    // Update UI with real-time data
    updateDisplay(recorder.currentHR(), recorder.currentZone());
  }

  const session = recorder.end();
});
```

### With Polar Device Preference

```typescript
import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { POLAR_H10, POLAR_OH1 } from '@hrkit/polar';
import { WebBluetoothTransport } from '@hrkit/web';

const transport = new WebBluetoothTransport();

// Browser picker shows devices matching any of these profiles
const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10, POLAR_OH1],
  fallback: GENERIC_HR,
});
```

## How It Works

`WebBluetoothTransport` implements the `BLETransport` interface from `@hrkit/core`:

- **`scan(profiles?)`** — Calls `navigator.bluetooth.requestDevice()` with filters derived from the provided profiles. Opens the browser's BLE picker. Yields the single user-selected device, then ends.
- **`stopScan()`** — No-op. Web Bluetooth's scan is modal and ends when the user makes a selection.
- **`connect(deviceId, profile)`** — Retrieves a previously selected device via `navigator.bluetooth.getDevices()`, connects to its GATT server, discovers the HR service, and returns an `HRConnection` that streams `HRPacket` data via characteristic notifications.

### Disconnect Handling

The connection listens for `gattserverdisconnected` events. The `onDisconnect` promise resolves when the device disconnects:

```typescript
conn.onDisconnect.then(() => {
  console.log('Sensor disconnected');
  // Show reconnect UI
});

// Or explicitly disconnect
await conn.disconnect();
```

## API

### `isWebBluetoothSupported()`

```typescript
function isWebBluetoothSupported(): boolean;
```

Returns `true` when `navigator.bluetooth` exists. Safe to call from SSR (returns `false` when `navigator` is undefined).

### `WebBluetoothTransport`

```typescript
class WebBluetoothTransport implements BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

No constructor arguments — the transport uses the global `navigator.bluetooth` API.
