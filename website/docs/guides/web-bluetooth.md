---
sidebar_position: 5
title: Web Bluetooth Setup
description: Use @hrkit in the browser with the Web Bluetooth API.
---

# Web Bluetooth Setup

The `@hrkit/web` package provides a BLE transport adapter for the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API), letting you connect to heart rate sensors directly from a web page.

## Install

```bash
npm install @hrkit/core @hrkit/web
```

## Browser compatibility

| Browser | Supported |
|---------|:---------:|
| Chrome (desktop & Android) | ✅ |
| Edge (desktop) | ✅ |
| Opera | ✅ |
| Firefox | ❌ |
| Safari (iOS & macOS) | ❌ |

Check [Can I Use](https://caniuse.com/web-bluetooth) for current status.

## Constraints

- **User gesture required** — `scan()` triggers the browser's device picker and must be called from a user-initiated event handler (click, tap, etc.)
- **Single device selection** — Web Bluetooth presents a modal picker. The user selects one device, and `scan()` yields that single device
- **HTTPS required** — Web Bluetooth only works on secure origins (`https://` or `localhost`)
- **No RSSI during scan** — Web Bluetooth doesn't expose signal strength. `HRDevice.rssi` is always `0`

## Usage

```typescript
import { connectToDevice, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { WebBluetoothTransport } from '@hrkit/web';

const transport = new WebBluetoothTransport();

// Must be called from a user gesture handler
document.getElementById('connect-btn')!.addEventListener('click', async () => {
  const conn = await connectToDevice(transport, {
    prefer: [GENERIC_HR],
  });

  console.log('Connected:', conn.deviceName);

  const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

  for await (const packet of conn.heartRate()) {
    recorder.ingest(packet);
    updateDisplay(recorder.currentHR(), recorder.currentZone());
  }

  const session = recorder.end();
});
```

### With Polar device preference

```typescript
import { POLAR_H10, POLAR_OH1 } from '@hrkit/polar';
import { GENERIC_HR } from '@hrkit/core/profiles';

const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10, POLAR_OH1],
  fallback: GENERIC_HR,
});
```

The browser picker shows devices matching any of the provided profiles.

## How it works

`WebBluetoothTransport` implements the `BLETransport` interface:

- **`scan(profiles?)`** — Calls `navigator.bluetooth.requestDevice()` with filters derived from profiles. Opens the browser picker. Yields the selected device, then ends.
- **`stopScan()`** — No-op. The browser picker is modal and ends on user selection.
- **`connect(deviceId, profile)`** — Connects to the GATT server, discovers the HR service, and returns an `HRConnection` that streams `HRPacket` data via characteristic notifications.

## Disconnect handling

```typescript
// Listen for disconnects
conn.onDisconnect.then(() => {
  console.log('Sensor disconnected');
  // Show reconnect UI
});

// Or explicitly disconnect
await conn.disconnect();
```

## Tips

- **Always use a button click** — The `connectToDevice` call chain must originate from a user gesture, or the browser will block the picker.
- **Test on localhost** — During development, `localhost` counts as a secure origin. No HTTPS certificate needed.
- **Check API availability** — Guard with `if ('bluetooth' in navigator)` before showing the connect button.
