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
import { AntTransport } from '@hrkit/ant';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

const transport = new AntTransport();
const connection = await connectToDevice(transport, GENERIC_HR);
for await (const packet of connection.packets) {
  console.log('HR:', packet.heartRate);
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/ant#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/ant`](https://github.com/josedab/hrkit/tree/main/packages/ant) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/ant)
