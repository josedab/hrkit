---
sidebar_position: 3
title: Using Polar Devices
description: Unlock ECG streaming and accelerometer data on Polar H10, H9, OH1, and Verity Sense.
---

# Using Polar Devices

The `@hrkit/polar` package adds support for Polar's proprietary PMD (Performance Measurement Data) protocol. This enables raw ECG streaming at 130Hz and accelerometer data on compatible devices.

## Install

```bash
npm install @hrkit/core @hrkit/polar
```

## Device profiles

```typescript
import { POLAR_H10, POLAR_H9, POLAR_OH1, POLAR_VERITY_SENSE } from '@hrkit/polar';
```

| Profile | Heart Rate | RR Intervals | ECG | Accelerometer |
|---------|:----------:|:------------:|:---:|:-------------:|
| `POLAR_H10` | ✅ | ✅ | ✅ | ✅ |
| `POLAR_H9` | ✅ | ✅ | ✅ | ❌ |
| `POLAR_OH1` | ✅ | ✅ | ❌ | ✅ |
| `POLAR_VERITY_SENSE` | ✅ | ✅ | ❌ | ✅ |

## Connecting with preference

Prefer a Polar device but fall back to any HR sensor:

```typescript
import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { POLAR_H10, isPolarConnection } from '@hrkit/polar';

const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10],
  fallback: GENERIC_HR,
});

// Standard HR works on every device
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// Check if we got a Polar device
if (isPolarConnection(conn)) {
  console.log('Polar device:', conn.profile.model);
}
```

## Type guard

`isPolarConnection()` narrows an `HRConnection` to `PolarConnection`:

```typescript
import { isPolarConnection } from '@hrkit/polar';

if (isPolarConnection(conn)) {
  // conn is now typed as PolarConnection
  // conn.ecg() and conn.accelerometer() are available
}
```

The guard checks whether the connection's profile includes the Polar PMD service UUID.

## PMD command builders

Build binary commands for the PMD Control Point characteristic:

```typescript
import {
  buildStartECGCommand,
  buildStartACCCommand,
  buildStopECGCommand,
  buildStopACCCommand,
  buildGetSettingsCommand,
  PMD_MEASUREMENT_ECG,
} from '@hrkit/polar';

// Start ECG streaming (130Hz, 14-bit resolution)
const startECG: Uint8Array = buildStartECGCommand();

// Start accelerometer (25, 50, 100, or 200 Hz)
const startACC: Uint8Array = buildStartACCCommand(50);

// Stop measurements
const stopECG: Uint8Array = buildStopECGCommand();
const stopACC: Uint8Array = buildStopACCCommand();

// Query device capabilities
const query: Uint8Array = buildGetSettingsCommand(PMD_MEASUREMENT_ECG);
```

## PMD data parsers

Parse binary notification data from the PMD Data characteristic:

```typescript
import { parseECGData, parseACCData, parsePMDControlResponse } from '@hrkit/polar';

// Parse ECG notification
const ecgPacket = parseECGData(dataView);
// → { timestamp: number, samples: number[], sampleRate: 130 }
// samples are in microvolts

// Parse accelerometer notification
const accPacket = parseACCData(dataView, 50);
// → { timestamp: number, samples: Array<{x, y, z}>, sampleRate: 50 }
// samples are in milliG

// Parse control point response
const response = parsePMDControlResponse(dataView);
// → { opCode, measurementType, status, success: boolean, parameters: Uint8Array }
```

## PMD frame formats

### ECG frame

```
byte 0:     measurement type (0x00 = ECG)
bytes 1-8:  timestamp (uint64 LE, microseconds)
byte 9:     frame type (0x00 = delta)
bytes 10+:  samples (3 bytes each, signed 24-bit LE, microvolts)
```

### ACC frame

```
byte 0:     measurement type (0x02 = ACC)
bytes 1-8:  timestamp (uint64 LE, microseconds)
byte 9:     frame type (0x00 = delta)
bytes 10+:  samples (6 bytes each: x, y, z as int16 LE, milliG)
```

:::note
The BLE transport adapters (`@hrkit/react-native`, `@hrkit/web`) currently implement standard HR streaming only. To use PMD protocol features for ECG/ACC, you need to wire up PMD characteristic writes and notifications in your transport layer using the command builders and parsers above.
:::
