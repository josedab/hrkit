---
sidebar_position: 6
title: Building a Custom Transport
description: Implement BLETransport for any platform — Node.js, desktop, embedded, or testing.
---

# Building a Custom Transport

The `BLETransport` interface is the only thing @hrkit needs from a platform. Implement it for any runtime to unlock the full SDK.

## The interface

```typescript
import type { BLETransport, HRConnection, HRDevice, DeviceProfile, HRPacket } from '@hrkit/core';

interface BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

## Implementing scan

`scan()` returns an async iterable that yields discovered devices. Filter by profile if provided:

```typescript
async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
  // Start your platform's BLE scan
  // Filter by serviceUUIDs from profiles
  const serviceUUIDs = profiles?.flatMap((p) => p.serviceUUIDs) ?? [];

  // Yield discovered devices
  yield {
    id: 'device-id-from-platform',
    name: 'Device Name',
    rssi: -65,
    profile: matchedProfile, // optional: the profile that matched
  };
}
```

Key requirements:
- Deduplicate devices by ID
- Match device names against `profile.namePrefix` when available
- End the iterable when `stopScan()` is called

## Implementing connect

`connect()` returns an `HRConnection` that streams heart rate data:

```typescript
interface HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;

  heartRate(): AsyncIterable<HRPacket>;
  disconnect(): Promise<void>;
  readonly onDisconnect: Promise<void>;
}
```

The `heartRate()` method is the core integration point. It must:

1. Subscribe to BLE Heart Rate Measurement notifications (characteristic `0x2A37`)
2. Parse each notification into an `HRPacket`
3. Yield packets as an async iterable
4. End when the device disconnects or `disconnect()` is called

## Parsing GATT data

Use the built-in parser to convert raw BLE bytes to `HRPacket`:

```typescript
import { parseHeartRate } from '@hrkit/core';

// When you receive a BLE notification on characteristic 0x2A37:
function onNotification(data: DataView) {
  const packet: HRPacket = parseHeartRate(data);
  // packet.hr — heart rate in bpm
  // packet.rrIntervals — RR intervals in milliseconds
  // packet.contactDetected — skin contact status
  // packet.energyExpended — cumulative kJ (if available)
}
```

:::info RR interval conversion
The parser handles the BLE-standard 1/1024s to milliseconds conversion automatically. Raw BLE values are multiplied by `1000/1024`, not `1000`. This is a common implementation error in other libraries.
:::

## Example: Node.js adapter skeleton

```typescript
import type { BLETransport, HRConnection, HRDevice, DeviceProfile } from '@hrkit/core';
import { parseHeartRate, GATT_HR_SERVICE_UUID, GATT_HR_MEASUREMENT_UUID } from '@hrkit/core';

export class NodeBLETransport implements BLETransport {
  private scanning = false;

  async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    this.scanning = true;
    const serviceUUIDs = profiles?.flatMap((p) => p.serviceUUIDs) ?? [];

    // Use your platform BLE library to scan
    // Yield devices as they are discovered
    // Stop when this.scanning becomes false
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
  }

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    // Connect to the device using your platform BLE library
    // Discover services and characteristics
    // Return an HRConnection implementation
    return {
      deviceId,
      deviceName: 'Device',
      profile,
      heartRate: async function* () {
        // Subscribe to HR characteristic notifications
        // Use parseHeartRate() to convert raw bytes
        // Yield HRPacket objects
      },
      disconnect: async () => {
        // Disconnect from the device
      },
      onDisconnect: new Promise((resolve) => {
        // Resolve when the device disconnects
      }),
    };
  }
}
```

## Testing your transport

Use the same patterns as the SDK's own tests:

```typescript
import { connectToDevice, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { NodeBLETransport } from './node-transport';

const transport = new NodeBLETransport();
const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
```

Once your transport implements `BLETransport`, every feature in @hrkit works automatically — metrics, session recording, device profiles, everything.

## Next steps

- **[Device Profiles](../core-concepts/device-profiles)** — Understand the capability model your transport plugs into
- **[Plugin Architecture](./plugins)** — Extend recording with lifecycle-hook plugins
