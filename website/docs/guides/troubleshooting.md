---
sidebar_position: 11
---

# Errors & Troubleshooting

`@hrkit/core` exports a small, structured error hierarchy so you can catch and recover from failures predictably. All errors extend `HRKitError`, which extends the built-in `Error`.

## Error hierarchy

| Class | `code` | Thrown when… |
|---|---|---|
| `HRKitError` | _(any string, optional)_ | Base class; catch this to handle any `@hrkit` failure |
| `ParseError` | `PARSE_ERROR` | A BLE buffer is truncated or malformed (e.g. GATT or PMD frame too short) |
| `ConnectionError` | `CONNECTION_ERROR` | A BLE connection cannot be established or is lost mid-stream |
| `TimeoutError` | `TIMEOUT_ERROR` | A scan or connection attempt exceeds the configured timeout |
| `DeviceNotFoundError` | `DEVICE_NOT_FOUND` | No compatible device is discovered during a scan |
| `ValidationError` | `VALIDATION_ERROR` | A packet, session, or athlete profile fails validation. Carries `errors[]` and `warnings[]` |

> Custom subclasses can supply their own `code` string, but the defaults above are stable and safe to switch on.

## Recommended catch pattern

```ts
import {
  connectToDevice,
  ConnectionError,
  DeviceNotFoundError,
  ParseError,
  TimeoutError,
  ValidationError,
  HRKitError,
} from '@hrkit/core';

try {
  const conn = await connectToDevice(transport, { prefer: [GENERIC_HR], timeout: 8000 });
  for await (const packet of conn.heartRate()) {
    // ...
  }
} catch (err) {
  if (err instanceof DeviceNotFoundError) {
    // No HR device near the user — prompt them to power it on.
  } else if (err instanceof TimeoutError) {
    // Scan/connect took too long — offer a retry.
  } else if (err instanceof ConnectionError) {
    // Pair lost mid-stream — see "Connection drops" below for connectWithReconnect().
  } else if (err instanceof ParseError) {
    // Malformed BLE packet — usually a transient hardware glitch; the SDK
    // already wraps adapter parse() in try/catch so the stream survives.
  } else if (err instanceof ValidationError) {
    console.error(err.errors, err.warnings);
  } else if (err instanceof HRKitError) {
    // Any other @hrkit error
  } else {
    throw err; // not from @hrkit
  }
}
```

## Common scenarios

### `DeviceNotFoundError` on first scan

- The device is asleep — most chest straps wake on movement; tap or wear it.
- Browser: Web Bluetooth requires a **user gesture** (button click) and HTTPS.
- React Native: confirm you granted `BLUETOOTH_SCAN` (Android 12+) and Location.
- Check the requested `DeviceProfile.namePrefix` actually matches the BLE advertisement (use `transport.scan()` with `GENERIC_HR` first to inspect names).

### `TimeoutError` during connect

- Increase `timeout` in `connectToDevice(transport, { timeout: 12_000 })`.
- Another central (phone, watch) may already be paired — disconnect it.
- For long sessions, prefer `connectWithReconnect()` which retries with exponential backoff.

### Connection drops mid-stream (`ConnectionError`)

Use the streaming reconnect helper — it surfaces a `ConnectionState` observable and recovers transparently:

```ts
import { connectWithReconnect } from '@hrkit/core';

const handle = connectWithReconnect(transport, { prefer: [GENERIC_HR] });
handle.state$.subscribe((s) => console.log('BLE state:', s)); // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

for await (const packet of handle.heartRate()) {
  recorder.ingest(packet);
}
```

### `ParseError` on a specific device

The GATT parser validates buffer length before reading any field. If you see persistent `ParseError`s from a device, it almost certainly ships a non-standard advertisement — file an issue with the raw buffer (`event.target.value` from Web Bluetooth, or `characteristic.value` from RN) and we can add a profile.

### `ValidationError` from `validateHRPacket()` / `analyzeSession()`

`ValidationError.errors` lists hard failures; `ValidationError.warnings` lists soft issues (e.g. HR > configured `maxHR`). You can usually log warnings and continue.

## Don't see your error?

Open an issue at [github.com/josedab/hrkit/issues](https://github.com/josedab/hrkit/issues) with the error name, `code`, stack trace, and (if BLE) the device's brand and model.

## Next steps

- **[FAQ](../faq)** — Answers to common questions about setup and usage
- **[Building a Custom Transport](./custom-transport)** — Debug connection issues by understanding the transport layer
