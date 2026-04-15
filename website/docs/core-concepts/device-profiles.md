---
sidebar_position: 2
title: Device Profiles & Capabilities
description: How @hrkit models devices with capability-based profiles for graceful degradation.
---

# Device Profiles & Capabilities

@hrkit uses a **capability-based device model**. Instead of coding against specific devices, you declare what capabilities you need, and the SDK handles the rest.

## DeviceProfile

Every device is described by a `DeviceProfile`:

```typescript
type Capability = 'heartRate' | 'rrIntervals' | 'ecg' | 'accelerometer';

interface DeviceProfile {
  brand: string;
  model: string;
  namePrefix: string;        // used for BLE scan filtering
  capabilities: Capability[];
  serviceUUIDs: string[];
}
```

- **`namePrefix`** — Matched against the BLE advertised name during scanning. An empty string matches any device.
- **`capabilities`** — Declares what this device supports. Used for feature gating at runtime.
- **`serviceUUIDs`** — BLE service UUIDs to filter during scanning.

## Built-in profiles

### @hrkit/core

```typescript
import { GENERIC_HR } from '@hrkit/core/profiles';
```

`GENERIC_HR` matches **any** BLE device advertising the standard Heart Rate service. It has an empty `namePrefix`, so it won't filter by name.

### @hrkit/polar

```typescript
import { POLAR_H10, POLAR_H9, POLAR_OH1, POLAR_VERITY_SENSE } from '@hrkit/polar';
```

| Profile | Heart Rate | RR Intervals | ECG | Accelerometer |
|---------|:----------:|:------------:|:---:|:-------------:|
| `POLAR_H10` | ✅ | ✅ | ✅ | ✅ |
| `POLAR_H9` | ✅ | ✅ | ✅ | ❌ |
| `POLAR_OH1` | ✅ | ✅ | ❌ | ✅ |
| `POLAR_VERITY_SENSE` | ✅ | ✅ | ❌ | ✅ |

## Custom profiles

Define a profile for any BLE HR device:

```typescript
import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';

const WAHOO_TICKR: DeviceProfile = {
  brand: 'Wahoo',
  model: 'TICKR',
  namePrefix: 'TICKR',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

// Use it like any built-in profile
const conn = await connectToDevice(transport, { prefer: [WAHOO_TICKR] });
```

## Connecting with preferences

`connectToDevice` accepts an ordered list of preferred profiles with an optional fallback:

```typescript
import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { POLAR_H10 } from '@hrkit/polar';

const conn = await connectToDevice(transport, {
  prefer: [POLAR_H10],     // try H10 first
  fallback: GENERIC_HR,    // fall back to any HR device
  timeoutMs: 10000,        // scan timeout (default: 10s)
});
```

The SDK scans for devices matching the preferred profiles first. If none are found within the timeout, it falls back to the fallback profile.

## Capability gating

Write code that degrades gracefully based on device capabilities:

```typescript
import { isPolarConnection } from '@hrkit/polar';

// Standard HR — works on every device
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// ECG — only on Polar devices with PMD support
if (isPolarConnection(conn) && conn.profile.capabilities.includes('ecg')) {
  for await (const frame of conn.ecg()) {
    // 130Hz ECG stream available
  }
}
```

This pattern ensures your app works with any BLE HR device while unlocking advanced features on supported hardware.
