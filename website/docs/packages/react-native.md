---
title: "@hrkit/react-native"
description: "React Native BLE adapter for @hrkit using react-native-ble-plx"
---

# @hrkit/react-native

React Native BLE adapter for @hrkit using react-native-ble-plx

## Install

```bash
pnpm add @hrkit/react-native
```

## Key features

- **ReactNativeBLETransport** — wraps `react-native-ble-plx` as a `BLETransport`
- **`isBleManagerReady()`** — checks BLE adapter state before scanning
- **Permission handling** — built-in Android/iOS BLE permission requests

## Quick example

```typescript
import { ReactNativeBLETransport, isBleManagerReady } from '@hrkit/react-native';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

const transport = new ReactNativeBLETransport();
if (await isBleManagerReady(transport)) {
  const connection = await connectToDevice(transport, GENERIC_HR);
  for await (const packet of connection.packets) {
    console.log('HR:', packet.heartRate);
  }
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/react-native#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/react-native`](https://github.com/josedab/hrkit/tree/main/packages/react-native) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/react-native)
