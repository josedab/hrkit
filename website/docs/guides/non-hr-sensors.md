---
sidebar_position: 22
title: Non-HR Sensors
description: Parse cycling power, speed/cadence, running metrics, and pulse oximetry.
---

# Non-HR Sensors

@hrkit isn't limited to heart rate. The `@hrkit/core` package includes parsers for additional BLE GATT services: cycling power, cycling speed & cadence (CSC), running speed & cadence (RSC), and pulse oximetry. Each parser takes a raw `DataView` from a BLE notification and returns a typed packet.

## Cycling power

Parse the Cycling Power Measurement characteristic (UUID `0x2A63`):

```typescript
import { parseCyclingPower } from '@hrkit/core';

const packet = parseCyclingPower(dataView, Date.now());
// packet.instantaneousPower → watts
// packet.pedalPowerBalance  → left/right balance (0–100%, if available)
// packet.cumulativeRevolutions → total crank revolutions
// packet.lastEventTime     → 1/1024s resolution timestamp
```

The parser handles flag-driven optional fields — pedal balance, accumulated torque, and wheel/crank revolution data are only present when the sensor's flags indicate support.

## Cycling speed & cadence (CSC)

Parse the CSC Measurement characteristic (UUID `0x2A5B`):

```typescript
import { parseCSC } from '@hrkit/core';

const packet = parseCSC(dataView, Date.now());
// packet.cumulativeWheelRevolutions → total wheel revolutions (if present)
// packet.lastWheelEventTime         → 1/2048s resolution
// packet.cumulativeCrankRevolutions → total crank revolutions (if present)
// packet.lastCrankEventTime         → 1/1024s resolution
```

CSC sensors may report wheel data, crank data, or both, depending on sensor type. The parser reads the flags byte to determine which fields are present.

### Computing cadence RPM

Use `computeCadenceRPM()` to derive instantaneous cadence from two successive CSC packets. It handles `uint16` wraparound for revolution counters:

```typescript
import { parseCSC, computeCadenceRPM } from '@hrkit/core';

let prev = parseCSC(firstView, Date.now());

// On next notification:
const curr = parseCSC(nextView, Date.now());
const rpm = computeCadenceRPM(prev, curr);
console.log(`Cadence: ${rpm.toFixed(0)} RPM`);
prev = curr;
```

## Running speed & cadence (RSC)

Parse the RSC Measurement characteristic (UUID `0x2A53`):

```typescript
import { parseRSC } from '@hrkit/core';

const packet = parseRSC(dataView, Date.now());
// packet.instantaneousSpeed   → m/s
// packet.instantaneousCadence → steps/min
// packet.instantaneousStrideLength → meters (if available)
// packet.totalDistance         → meters (if available)
```

Like cycling parsers, RSC handles flag-driven fields — stride length and total distance are only present when the sensor reports them.

## Pulse oximetry

Parse the PLX Continuous Measurement characteristic (UUID `0x2A5F`):

```typescript
import { parsePulseOxContinuous } from '@hrkit/core';

const packet = parsePulseOxContinuous(dataView, Date.now());
// packet.spO2          → blood oxygen saturation (%)
// packet.pulseRate     → heart rate from SpO2 sensor (bpm)
// packet.perfusionIndex → signal quality indicator (if available)
```

### sFloat16 decoder

Pulse ox characteristics use GATT's 16-bit short float format (IEEE 11073). The `sFloat16` helper decodes these values:

```typescript
import { sFloat16 } from '@hrkit/core';

const value = sFloat16(rawUint16);
```

This is used internally by `parsePulseOxContinuous` but is exported for custom characteristic parsing.

## Built-in device profiles

Each sensor type has a corresponding `DeviceProfile` that declares its BLE service UUIDs and capabilities:

```typescript
import {
  CYCLING_POWER_PROFILE,
  CYCLING_CSC_PROFILE,
  RUNNING_RSC_PROFILE,
  PULSE_OX_PROFILE,
} from '@hrkit/core';

// Use profiles to scan for specific sensor types
console.log(CYCLING_POWER_PROFILE.serviceUUIDs);
// → ['00001818-0000-1000-8000-00805f9b34fb']
```

Profiles integrate with the device capability model — consumer code requests capabilities (e.g., "cycling power"), and the system matches to compatible sensors.

## Event time units

BLE GATT sensor characteristics use fractional-second event times that differ by characteristic:

| Characteristic | Resolution | Unit |
|---------------|------------|------|
| Cycling power (crank) | 1/1024 s | ~0.977 ms per tick |
| CSC (wheel) | 1/2048 s | ~0.488 ms per tick |
| CSC (crank) | 1/1024 s | ~0.977 ms per tick |

The parsers return these raw timestamps. When computing deltas between successive measurements, use the appropriate resolution for accurate speed/cadence calculations.

:::info
All sensor parsers are pure functions with zero dependencies. They only require a `DataView` constructed from the raw BLE notification payload. No platform imports, no state.
:::

## Next steps

- **[Sensor Fusion](./sensor-fusion)** — Fuse non-HR sensor data with heart rate using Kalman filtering
- **[Multi-Device Fusion](./multi-device)** — Manage multiple BLE sensors in a single session
- **[Device Profiles](../core-concepts/device-profiles)** — Understand the capability model for declaring sensor support
