---
title: "@hrkit/capacitor-native"
description: "Native Capacitor plugin for @hrkit — direct CoreBluetooth (iOS) and android.bluetooth (Android) bindings, no community deps."
---

# @hrkit/capacitor-native

Native Capacitor plugin for @hrkit — direct CoreBluetooth (iOS) and android.bluetooth (Android) bindings, no community deps.

## Install

```bash
pnpm add @hrkit/capacitor-native
```

## Key features

- **Direct native BLE** — CoreBluetooth on iOS, `android.bluetooth` on Android
- **No community deps** — ships its own native plugin, no `@capacitor-community/bluetooth-le` required
- **BLETransport interface** — drop-in replacement for other adapters

## Quick example

```typescript
import { CapacitorNativeBLETransport } from '@hrkit/capacitor-native';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

const transport = new CapacitorNativeBLETransport();
const connection = await connectToDevice(transport, GENERIC_HR);
for await (const packet of connection.packets) {
  console.log('HR:', packet.heartRate);
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/capacitor-native#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/capacitor-native`](https://github.com/josedab/hrkit/tree/main/packages/capacitor-native) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/capacitor-native)
