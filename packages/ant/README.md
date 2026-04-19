# @hrkit/ant

ANT+ bridge for [@hrkit](https://github.com/josedab/hrkit). Wraps a USB ANT+ stick (Garmin or compatible) so HR / power / cadence / speed sensors expose the same `BLETransport` interface as the native BLE adapters — the rest of your app can stay protocol-agnostic.

`ant-plus-next` is an **optional peer dependency**: the package type-checks and tree-shakes fine without it. You only need it at runtime if you call `loadGarminStick()`.

## Install

```bash
npm install @hrkit/ant ant-plus-next
```

You also need a USB ANT+ stick attached and the platform's USB driver (libusb / WinUSB) configured.

## Usage

`AntTransport` requires you to bring your own stick + channel list — there's no global state. The `loadGarminStick()` helper is the easiest way to obtain a real stick when `ant-plus-next` is installed.

```ts
import {
  AntTransport,
  loadGarminStick,
  type AntChannel,
  type AntDataPoint,
} from '@hrkit/ant';
import { GENERIC_HR } from '@hrkit/core';

const stick = await loadGarminStick(); // throws HRKitError(MISSING_PEER) if ant-plus-next missing

// Build a channel for the HR sensor with deviceId 12345.
// Replace this with whatever your `ant-plus-next` integration emits.
const hrChannel: AntChannel = {
  sensorType: 'hr',
  deviceId: 12345,
  on: (_event, _listener) => {
    /* wire to your ant-plus-next channel events */
  },
};

const transport = new AntTransport({
  stick,
  channels: [hrChannel],
  profileFor: (ch) => (ch.sensorType === 'hr' ? GENERIC_HR : GENERIC_HR /* …add power profile etc. */),
});

for await (const dev of transport.scan()) {
  const conn = await transport.connect(dev.id, dev.profile);
  for await (const packet of conn.heartRate()) {
    console.log(packet.hr, packet.rrIntervals);
  }
}

await transport.close();
```

## API

| Symbol | Description |
|--------|-------------|
| `AntTransport` | `BLETransport` implementation backed by an `AntStick` + a fixed channel list. Scan emits one `HRDevice` per registered channel. |
| `AntTransportOptions` | `{ stick, channels, profileFor(channel) }` constructor options. |
| `loadGarminStick()` | Lazy-import wrapper around `GarminStick3` / `GarminStick2` from `ant-plus-next`. Throws `HRKitError('MISSING_PEER')` with the install command if the peer is absent. |
| `AntStick` | Minimal `{ open, close, attach }` interface — implement directly to plug in mocks or non-Garmin sticks. |
| `AntChannel` | `{ sensorType, deviceId, on }` — emit `'data'` (with an `AntDataPoint`) and `'attached'` events. |
| `AntDataPoint` | `{ timestamp, hr?, power?, cadence?, speed? }` — only the fields the channel produces are populated. |
| `AntSensorType` | `'hr' \| 'power' \| 'cadence' \| 'speed'`. |

## Why bring your own channel list

`ant-plus-next` exposes per-sensor channel classes (`HeartRateSensor`, `BicyclePowerSensor`, etc.) and their lifecycle is opinionated. Rather than hard-coding one mapping in this package, `AntTransport` accepts any object satisfying the small `AntChannel` shape — so you can:

- Mix HR + power + cadence into one transport without forking the bridge.
- Mock the entire ANT+ stack in tests with no USB dependency.
- Adopt new sensor types as `ant-plus-next` adds them.

A future minor version may ship a convenience helper that builds a default channel list from `ant-plus-next` directly.

## Failure modes

| Situation | Result |
|-----------|--------|
| `ant-plus-next` not installed and `loadGarminStick()` is called | `HRKitError({ code: 'MISSING_PEER' })` with the install hint |
| `ant-plus-next` installed but no `GarminStick2` / `GarminStick3` export | `HRKitError({ code: 'MISSING_PEER' })` — usually a version mismatch |
| `stick.open()` returns `false` | `Error('ANT+ stick failed to open')` from `connect()` |
| `connect(deviceId, …)` for an id not in the channel list | `Error('ANT+ device <id> not registered')` |

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/ant/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
