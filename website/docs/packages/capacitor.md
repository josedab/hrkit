---
title: "@hrkit/capacitor"
description: "Capacitor BLE adapter for @hrkit (iOS + Android via @capacitor-community/bluetooth-le)"
---

# @hrkit/capacitor

Capacitor BLE adapter for @hrkit (iOS + Android via @capacitor-community/bluetooth-le)

## Install

```bash
pnpm add @hrkit/capacitor
```

## Key features

- **CapacitorBLETransport** — implements `BLETransport` via `@capacitor-community/bluetooth-le`
- **Cross-platform** — iOS + Android support through Capacitor's native bridge
- **Web fallback** — uses Web Bluetooth when running in the browser shell

## Quick example

```typescript
import { CapacitorBLETransport } from '@hrkit/capacitor';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

const transport = new CapacitorBLETransport();
const connection = await connectToDevice(transport, GENERIC_HR);
for await (const packet of connection.packets) {
  console.log('HR:', packet.heartRate);
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/capacitor#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/capacitor`](https://github.com/josedab/hrkit/tree/main/packages/capacitor) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/capacitor)
