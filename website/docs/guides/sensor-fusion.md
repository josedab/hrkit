---
sidebar_position: 20
title: Sensor Fusion
description: Kalman-filter-based multi-sensor heart rate fusion with quality scoring.
---

# Sensor Fusion

When an athlete wears multiple sensors (e.g., chest strap + smartwatch), `SensorFusion` combines their readings using a **Kalman filter** to produce a single, more accurate HR value. Each source gets a quality score based on sensor type and artifact rate.

:::tip When to use what
- **`MultiDeviceManager`** — simple "best-device" selection with fallback (documented in [Multi-Device](/docs/guides/multi-device))
- **`SensorFusion`** — statistical fusion of N sources into a single consensus HR with uncertainty estimates

Use `MultiDeviceManager` when you just need one "best" HR value. Use `SensorFusion` when you want a weighted consensus from all sources simultaneously.
:::

## Quick Start

```typescript
import { SensorFusion } from '@hrkit/core';

const fusion = new SensorFusion();

// Register sources with their type (affects quality priors)
fusion.addSource({ id: 'chest', label: 'Polar H10', type: 'chest_strap' });
fusion.addSource({ id: 'watch', label: 'Apple Watch', type: 'optical_wrist' });

// Push readings from each source
fusion.pushReading({ sourceId: 'chest', hr: 72, timestamp: Date.now() });
fusion.pushReading({ sourceId: 'watch', hr: 74, timestamp: Date.now() });

// Get fused result
const fused = fusion.getFused();
if (fused) {
  console.log(`HR: ${fused.hr} ±${fused.uncertainty} bpm`);
  console.log(`Primary source: ${fused.primarySourceId}`);
  console.log(`Active sources: ${fused.activeSourceCount}`);
}
```

## Quality Priors by Source Type

| Source Type | Default Quality | Typical Use |
|------------|:--------------:|-------------|
| `ecg` | 0.95 | Medical-grade ECG |
| `chest_strap` | 0.90 | Polar H10, Garmin HRM |
| `optical_arm` | 0.75 | Polar Verity Sense, Wahoo TICKR FIT |
| `optical_wrist` | 0.65 | Smartwatches, fitness bands |
| `other` | 0.50 | Custom sensors |

Quality degrades automatically when artifacts are detected (>30 bpm jump in <2 seconds).

## Configuration

```typescript
const fusion = new SensorFusion({
  processNoise: 0.5,       // Kalman process noise (higher = adapts faster)
  staleThresholdMs: 5000,  // Drop sources with no data for 5s
  minQuality: 0.1,         // Minimum quality to contribute
});
```

## Fused Output

```typescript
interface FusedOutput {
  hr: number;                             // Quality-weighted consensus HR
  uncertainty: number;                    // ±bpm (95% CI)
  timestamp: number;
  primarySourceId: string;                // Highest-quality contributing source
  sourceQualities: Map<string, number>;   // Per-source quality scores
  activeSourceCount: number;              // Sources currently contributing
}
```

## Real-Time Usage

```typescript
// Push readings as they arrive from different devices
chestConn.heartRate().subscribe(pkt => {
  fusion.pushReading({ sourceId: 'chest', hr: pkt.hr, timestamp: pkt.timestamp });
});

watchConn.heartRate().subscribe(pkt => {
  fusion.pushReading({ sourceId: 'watch', hr: pkt.hr, timestamp: pkt.timestamp });
});

// Poll fused result at your UI refresh rate
setInterval(() => {
  const fused = fusion.getFused();
  if (fused) updateDisplay(fused.hr, fused.uncertainty);
}, 1000);
```

## Automatic Failover

If a source stops sending data (exceeds `staleThresholdMs`), it's automatically excluded from the fusion. When it resumes, it seamlessly rejoins. There's no manual intervention needed.

```typescript
// Source management
fusion.removeSource('watch');    // Permanently remove
fusion.getSourceQualities();     // Check all quality scores
fusion.sourceIds;                // List registered source IDs
```
