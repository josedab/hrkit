---
sidebar_position: 3
title: Device Compatibility
description: Supported BLE heart rate devices and their capabilities.
---

# Device Compatibility

@hrkit works with **any BLE device** that implements the standard Bluetooth Heart Rate Profile (service UUID `0x180D`). This includes chest straps and optical sensors from all major brands.

## How compatibility works

The BLE Heart Rate Profile is a Bluetooth standard. Any device that advertises service `0x180D` and sends notifications on characteristic `0x2A37` is compatible with `@hrkit/core`. No special configuration needed.

## Built-in device profiles

### Generic

| Profile | Package | HR | RR | ECG | ACC |
|---------|---------|:--:|:--:|:---:|:---:|
| `GENERIC_HR` | `@hrkit/core` | ✅ | ✅ | ❌ | ❌ |

### Polar

| Profile | Package | HR | RR | ECG | ACC |
|---------|---------|:--:|:--:|:---:|:---:|
| `POLAR_H10` | `@hrkit/polar` | ✅ | ✅ | ✅ | ✅ |
| `POLAR_H9` | `@hrkit/polar` | ✅ | ✅ | ✅ | ❌ |
| `POLAR_OH1` | `@hrkit/polar` | ✅ | ✅ | ❌ | ✅ |
| `POLAR_VERITY_SENSE` | `@hrkit/polar` | ✅ | ✅ | ❌ | ✅ |

## Known compatible devices

These devices implement the standard BLE Heart Rate Profile and work with `GENERIC_HR`:

| Brand | Model | HR | RR Intervals | Notes |
|-------|-------|:--:|:------------:|-------|
| Polar | H10 | ✅ | ✅ | Best tested; also supports PMD (ECG/ACC) |
| Polar | H9 | ✅ | ✅ | Also supports PMD (ECG only) |
| Polar | OH1 | ✅ | ✅ | Optical; also supports PMD (ACC only) |
| Polar | Verity Sense | ✅ | ✅ | Optical; also supports PMD (ACC only) |
| Garmin | HRM-Pro / Plus | ✅ | ✅ | |
| Garmin | HRM-Dual | ✅ | ✅ | |
| Wahoo | TICKR / TICKR X | ✅ | ✅ | |
| Wahoo | TICKR FIT | ✅ | ✅ | Armband |
| Magene | H303 / H64 | ✅ | ✅ | |
| CooSpo | H808S | ✅ | ✅ | |
| Scosche | Rhythm+ / 24 | ✅ | Varies | Optical; RR support depends on model |

:::note
RR interval availability varies by device and firmware version. Most chest straps provide RR intervals. Some optical sensors may not. HR-only devices still work with @hrkit — HRV metrics just won't be available.
:::

## Adding your own device

If your device isn't listed but supports the standard BLE HR Profile, it already works. To get name-based scan filtering, create a custom profile:

```typescript
import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';

const MY_DEVICE: DeviceProfile = {
  brand: 'MyBrand',
  model: 'MyModel',
  namePrefix: 'MyDevice',  // matches BLE advertised name
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
```

See [Device Profiles & Capabilities](../core-concepts/device-profiles) for full details.
