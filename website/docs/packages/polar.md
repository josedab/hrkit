---
title: "@hrkit/polar"
description: "Polar PMD protocol utilities for @hrkit — ECG and accelerometer data streaming"
---

# @hrkit/polar

Polar PMD protocol utilities for @hrkit — ECG and accelerometer data streaming

## Install

```bash
pnpm add @hrkit/polar
```

## Key features

- **Device profiles** — Polar H10, H9, OH1, and Verity Sense
- **PMD protocol** — command builders for ECG/ACC start, stop, and read
- **ECG frame parser** — decode raw ECG samples from PMD data frames
- **Accelerometer parser** — decode 3-axis accelerometer frames
- **Type guard** — `isPolarConnection()` to check PMD capability at runtime

## Quick example

```typescript
import { POLAR_H10, isPolarConnection } from '@hrkit/polar';

// Use the Polar H10 profile when scanning
const conn = await transport.connect(deviceId, POLAR_H10);

if (isPolarConnection(conn)) {
  // Start ECG streaming at 130 Hz
  await conn.startECG();
  for await (const frame of conn.ecg$) {
    console.log('ECG samples:', frame.samples);
  }
}
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/polar#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/polar`](https://github.com/josedab/hrkit/tree/main/packages/polar) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/polar)
