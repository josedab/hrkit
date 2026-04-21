---
title: "@hrkit/web"
description: "Web Bluetooth API adapter for @hrkit heart rate monitoring"
---

# @hrkit/web

Web Bluetooth API adapter for @hrkit heart rate monitoring

## Install

```bash
pnpm add @hrkit/web
```

## Key features

- **WebBluetoothTransport** — implements the `BLETransport` interface for browsers
- **`isWebBluetoothSupported()`** — runtime feature check before scanning
- **Chromium-based browsers** — Chrome, Edge, Opera, and other Blink-based browsers

## Quick example

```typescript
import { WebBluetoothTransport, isWebBluetoothSupported } from '@hrkit/web';
import { connectToDevice, GENERIC_HR } from '@hrkit/core';

if (!isWebBluetoothSupported()) {
  console.error('Web Bluetooth not available in this browser');
} else {
  const transport = new WebBluetoothTransport();
  const connection = await connectToDevice(transport, GENERIC_HR);
  for await (const packet of connection.packets) {
    console.log('HR:', packet.heartRate);
  }
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/web#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/web`](https://github.com/josedab/hrkit/tree/main/packages/web) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/web)
