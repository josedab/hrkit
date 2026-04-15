# @hrkit/polar

Polar PMD (Performance Measurement Data) protocol utilities for `@hrkit`. Provides device profiles, type guards, and binary protocol command builders and parsers for Polar H10, H9, OH1, and Verity Sense.

## Install

```bash
npm install @hrkit/core @hrkit/polar
# or
pnpm add @hrkit/core @hrkit/polar
```

## What This Package Provides

`@hrkit/polar` contains **protocol-level utilities** for the Polar PMD service:

- **Device profiles** — Pre-defined `DeviceProfile` objects for Polar devices
- **Type guard** — `isPolarConnection()` to check if a connection supports PMD features
- **PMD command builders** — Build binary commands to start/stop ECG and accelerometer streaming
- **PMD data parsers** — Parse binary ECG and accelerometer notification frames
- **PMD control response parser** — Parse control point responses

> **Note:** The BLE transport adapters (`@hrkit/react-native`, `@hrkit/web`) currently implement standard HR streaming only. To use the PMD protocol utilities for ECG/ACC, you need to wire up PMD characteristic writes and notifications in your transport layer.

## Usage

### Device Profiles

```typescript
import { POLAR_H10, isPolarConnection } from '@hrkit/polar';
import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10],
  fallback: GENERIC_HR,
});

// Standard HR works on every device
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// Check if connected to a Polar device
if (isPolarConnection(conn)) {
  console.log('Polar device detected:', conn.profile.model);
  console.log('Capabilities:', conn.profile.capabilities);
}
```

### Device Capability Matrix

| Profile | Heart Rate | RR Intervals | ECG | Accelerometer |
|---------|:----------:|:------------:|:---:|:-------------:|
| `POLAR_H10` | ✅ | ✅ | ✅ | ✅ |
| `POLAR_H9` | ✅ | ✅ | ✅ | ❌ |
| `POLAR_OH1` | ✅ | ✅ | ❌ | ✅ |
| `POLAR_VERITY_SENSE` | ✅ | ✅ | ❌ | ✅ |

### PMD Command Builders

Build binary commands to write to the Polar PMD Control Point characteristic:

```typescript
import {
  buildStartECGCommand,
  buildStartACCCommand,
  buildStopECGCommand,
  buildStopACCCommand,
  buildGetSettingsCommand,
  PMD_MEASUREMENT_ECG,
  PMD_MEASUREMENT_ACC,
} from '@hrkit/polar';

// Start ECG at 130Hz, 14-bit resolution
const startECG: Uint8Array = buildStartECGCommand();

// Start accelerometer (25, 50, 100, or 200Hz)
const startACC: Uint8Array = buildStartACCCommand(50);

// Stop measurements
const stopECG: Uint8Array = buildStopECGCommand();
const stopACC: Uint8Array = buildStopACCCommand();

// Query device capabilities
const queryECG: Uint8Array = buildGetSettingsCommand(PMD_MEASUREMENT_ECG);
```

### PMD Data Parsers

Parse binary notification data from the Polar PMD Data characteristic:

```typescript
import { parseECGData, parseACCData, parsePMDControlResponse } from '@hrkit/polar';

// Parse ECG notification (3-byte samples, 14-bit signed, 130Hz)
const ecgPacket = parseECGData(dataView);
// → { timestamp: number, samples: number[], sampleRate: 130 }

// Parse accelerometer notification (6-byte samples: x/y/z int16 LE)
const accPacket = parseACCData(dataView, 50);
// → { timestamp: number, samples: Array<{x, y, z}>, sampleRate: 50 }

// Parse control point response
const response = parsePMDControlResponse(dataView);
// → { opCode, measurementType, status, success: boolean, parameters: Uint8Array }
```

### PMD Frame Formats

**ECG frame** (from PMD Data characteristic):
```
byte 0:     measurement type (0x00 = ECG)
bytes 1-8:  timestamp (uint64 LE, microseconds)
byte 9:     frame type (0x00 = delta)
bytes 10+:  samples (3 bytes each, signed 24-bit LE)
```

**ACC frame** (from PMD Data characteristic):
```
byte 0:     measurement type (0x02 = ACC)
bytes 1-8:  timestamp (uint64 LE, microseconds)
byte 9:     frame type (0x00 = delta)
bytes 10+:  samples (6 bytes each: x, y, z as int16 LE)
```

## API Reference

### Profiles

| Export | Type | Description |
|--------|------|-------------|
| `POLAR_H10` | `DeviceProfile` | Polar H10 chest strap. ECG + accelerometer. |
| `POLAR_H9` | `DeviceProfile` | Polar H9 chest strap. ECG only. |
| `POLAR_OH1` | `DeviceProfile` | Polar OH1 optical sensor. Accelerometer only. |
| `POLAR_VERITY_SENSE` | `DeviceProfile` | Polar Verity Sense optical sensor. Accelerometer only. |

### Guards

| Function | Description |
|----------|-------------|
| `isPolarConnection(conn)` | Type guard. Returns `true` if the connection's profile includes the PMD service UUID. Narrows to `PolarConnection`. |

### PMD Commands

| Function | Description |
|----------|-------------|
| `buildStartECGCommand()` | Start ECG streaming (130Hz, 14-bit). |
| `buildStartACCCommand(sampleRate?)` | Start ACC streaming. Default 25Hz. Supports 25, 50, 100, 200. |
| `buildStopECGCommand()` | Stop ECG streaming. |
| `buildStopACCCommand()` | Stop ACC streaming. |
| `buildStopCommand(type)` | Stop a measurement by type ID. |
| `buildGetSettingsCommand(type)` | Query measurement settings. |

### PMD Parsers

| Function | Description |
|----------|-------------|
| `parseECGData(data)` | Parse PMD ECG notification → `ECGPacket`. |
| `parseACCData(data, sampleRate?)` | Parse PMD ACC notification → `ACCPacket`. |
| `parsePMDControlResponse(data)` | Parse control point response → `PMDControlResponse`. |

### Types

| Type | Description |
|------|-------------|
| `PolarConnection` | Extends `HRConnection` with `ecg()`, `accelerometer()`, `requestMTU()`. |
| `ECGPacket` | `{ timestamp, samples: number[], sampleRate: 130 }` |
| `ACCPacket` | `{ timestamp, samples: ACCSample[], sampleRate: 25\|50\|100\|200 }` |
| `ACCSample` | `{ x: number, y: number, z: number }` |
| `PMDControlResponse` | `{ opCode, measurementType, status, success, parameters }` |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PMD_MEASUREMENT_ECG` | `0x00` | ECG measurement type ID |
| `PMD_MEASUREMENT_ACC` | `0x02` | Accelerometer measurement type ID |
