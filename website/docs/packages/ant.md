---
title: "@hrkit/ant"
description: "ANT+ bridge for @hrkit — wraps ant-plus-next so power, cadence and HR sensors expose the same BLETransport interface."
---

# @hrkit/ant

ANT+ bridge for @hrkit — wraps ant-plus-next so power, cadence and HR sensors expose the same BLETransport interface.

## Install

```bash
pnpm add @hrkit/ant
```

## Key features

- **ANT+ bridge** — exposes ANT+ power, cadence, and HR sensors as a `BLETransport`
- **Unified interface** — same `connectToDevice()` flow as BLE adapters
- **USB stick support** — works with standard ANT+ USB dongles via `ant-plus-next`

## Quick example

```typescript
import { AntTransport, loadGarminStick, type AntChannel } from '@hrkit/ant';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

const stick = await loadGarminStick();
const heartRateChannel: AntChannel = {
  sensorType: 'hr',
  deviceId: 12345,
  on: (_event, _listener) => {
    // Bridge your ant-plus-next channel events here.
  },
};
const transport = new AntTransport({
  stick,
  channels: [heartRateChannel],
  profileFor: () => GENERIC_HR,
});
const connection = await connectToDevice(transport, { prefer: [GENERIC_HR] });
for await (const packet of connection.heartRate()) {
  console.log('HR:', packet.hr);
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/ant#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/ant`](https://github.com/josedab/hrkit/tree/main/packages/ant) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/ant)
