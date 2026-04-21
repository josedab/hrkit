---
sidebar_position: 10
title: Multi-Device Fusion
description: Fuse heart rate data from multiple BLE sensors with MultiDeviceManager.
---

# Multi-Device Fusion

The `MultiDeviceManager` connects to multiple BLE HR sensors simultaneously and fuses their data into a single reliable stream. Useful for redundancy, accuracy comparison, or multi-sensor research.

## Quick Start

```typescript
import { MultiDeviceManager, connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const manager = new MultiDeviceManager({ strategy: 'consensus' });

// Connect two devices
const conn1 = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const conn2 = await connectToDevice(transport, { prefer: [GENERIC_HR] });

manager.addConnection(conn1);
manager.addConnection(conn2);

// Fused stream combines data from both devices
manager.fused$.subscribe((packet) => {
  console.log(`Fused HR: ${packet.hr} from ${packet.sourceDeviceIds.join(', ')}`);
  recorder.ingest(packet);
});

// Quality metrics per device
manager.quality$.subscribe((qualities) => {
  for (const q of qualities) {
    console.log(`${q.deviceName}: quality=${q.qualityScore.toFixed(2)}, artifacts=${q.artifactRate.toFixed(2)}`);
  }
});
```

## Fusion Strategies

| Strategy | Behavior |
|----------|----------|
| `'primary-fallback'` | Use the primary device. Fall back to the device with the most recent packet if primary goes stale. **(Default)** |
| `'consensus'` | Median HR across all non-stale devices. RR intervals from the device with the lowest artifact rate. |
| `'best-rr'` | Use the device with the cleanest RR intervals (lowest artifact rate). Best for HRV analysis. |

```typescript
// Choose strategy at construction time
const manager = new MultiDeviceManager({
  strategy: 'best-rr',
  primaryDeviceId: 'chest-strap-001',  // for primary-fallback
  staleThresholdMs: 3000,              // default: 3s
});
```

## Quality Scoring

Each device gets a real-time quality score (0–1) based on:

- **Artifact rate** — proportion of RR intervals deviating >20% from local mean
- **Drop rate** — gaps >2s between consecutive packets
- **Freshness** — how recently the last packet arrived

```typescript
const quality = manager.getDeviceQuality('device-001');
if (quality) {
  console.log(`Quality: ${quality.qualityScore}`);
  console.log(`Packets: ${quality.packetCount}, Drops: ${quality.dropCount}`);
}
```

## API Reference

### MultiDeviceManager

| Method / Property | Description |
|-------------------|-------------|
| `addConnection(conn)` | Add an HR connection to the fusion pool |
| `removeConnection(deviceId)` | Remove a device from the pool |
| `getQuality()` | Get quality metrics for all devices |
| `getDeviceQuality(id)` | Get quality for a specific device |
| `connectionCount` | Number of active connections |
| `stop()` | Disconnect all devices and stop |
| `fused$` | Observable: fused HR packets |
| `quality$` | Observable: per-device quality metrics |

### FusedHRPacket

Extends `HRPacket` with:

```typescript
interface FusedHRPacket extends HRPacket {
  sourceDeviceIds: string[];           // which device(s) contributed
  fusionStrategy: FusionStrategyType;  // which strategy was used
}
```

## Auto-Disconnect Handling

Connections are automatically removed from the pool when they disconnect. The manager continues operating with the remaining devices.

## Next steps

- **[Sensor Fusion](./sensor-fusion)** — Fuse multiple sources with Kalman filtering and quality scoring
- **[Group Sessions](./group-sessions)** — Monitor multiple athletes simultaneously with a coach dashboard
