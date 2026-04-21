---
sidebar_position: 1
title: HRV Metrics
description: Understand RMSSD, SDNN, pNN50, baseline tracking, and readiness verdicts.
---

# HRV Metrics

Heart Rate Variability (HRV) measures the variation in time between heartbeats (RR intervals). Higher HRV generally indicates better cardiovascular fitness and recovery. @hrkit provides validated, pure-function implementations of standard HRV metrics.

## Available metrics

### RMSSD

**Root Mean Square of Successive Differences** — the primary parasympathetic (rest & recovery) HRV metric.

```typescript
import { rmssd } from '@hrkit/core';

const rr = [800, 810, 790, 820, 805]; // milliseconds
rmssd(rr); // → ~14.2 ms
```

RMSSD captures beat-to-beat variability. Higher values indicate better parasympathetic tone. This is the metric most consumer HRV apps (Whoop, Oura, HRV4Training) use for daily readiness.

### SDNN

**Standard Deviation of NN intervals** — overall HRV reflecting both sympathetic and parasympathetic activity.

```typescript
import { sdnn } from '@hrkit/core';

sdnn([800, 810, 790, 820, 805]); // → ~9.4 ms
```

SDNN is more sensitive to recording duration. A 5-minute rest recording is the clinical standard.

### pNN50

**Percentage of successive RR differences greater than 50ms** — another parasympathetic marker.

```typescript
import { pnn50 } from '@hrkit/core';

pnn50([800, 810, 790, 820, 805]); // → 0 (no diffs > 50ms)
pnn50([800, 900, 750, 850, 700]); // → 100 (all diffs > 50ms)
```

### Mean HR

Calculate mean heart rate from RR intervals:

```typescript
import { meanHR } from '@hrkit/core';

meanHR([800, 810, 790, 820, 805]); // → ~74.2 bpm
```

## Artifact filtering

Real-world RR data contains artifacts — dropped beats, double-counted beats, motion noise. Always filter before computing HRV:

```typescript
import { filterArtifacts, rmssd } from '@hrkit/core';

const raw = [800, 810, 400, 820, 805, 1600, 790]; // 400ms and 1600ms are artifacts

const { filtered, artifactRate } = filterArtifacts(raw, {
  threshold: 0.2,       // flag values >20% from local mean (default)
  strategy: 'remove',   // or 'interpolate'
  windowSize: 5,        // sliding window size (default)
});

console.log(`Artifact rate: ${(artifactRate * 100).toFixed(1)}%`);
const cleanRmssd = rmssd(filtered);
```

**Strategies:**
- `'remove'` — Drops artifact intervals. Use when you have plenty of data.
- `'interpolate'` — Replaces artifacts with local mean. Preserves sample count but may smooth real variability.

## Baseline tracking

Track daily HRV to establish a personal baseline:

```typescript
import { hrBaseline, readinessVerdict } from '@hrkit/core';

const readings = [
  { date: '2024-01-08', rmssd: 62 },
  { date: '2024-01-09', rmssd: 58 },
  { date: '2024-01-10', rmssd: 65 },
  { date: '2024-01-11', rmssd: 60 },
  { date: '2024-01-12', rmssd: 63 },
  { date: '2024-01-13', rmssd: 61 },
  { date: '2024-01-14', rmssd: 59 },
];

// Median RMSSD over a 7-day window
const baseline = hrBaseline(readings, 7); // → 61
```

## Readiness verdicts

Compare today's RMSSD against your baseline to get a training readiness recommendation:

```typescript
const verdict = readinessVerdict(58, baseline!);
// → 'moderate'
```

| Verdict | Condition | Meaning |
|---------|-----------|---------|
| `'go_hard'` | today ≥ 95% of baseline | Recovery is strong. High intensity is appropriate. |
| `'moderate'` | today 80–95% of baseline | Some fatigue detected. Moderate training recommended. |
| `'rest'` | today < 80% of baseline | Significant fatigue or stress. Rest or light activity only. |

## Best practices

1. **Measure at the same time daily** — Morning readings before getting out of bed give the most consistent baseline.
2. **Use a chest strap** — Optical sensors are less accurate for RR interval detection.
3. **Record for at least 1 minute** — More data means more reliable RMSSD. 5 minutes is ideal for SDNN.
4. **Always filter artifacts** — Even a single artifact can dramatically skew RMSSD.
5. **Track trends, not absolutes** — Your baseline is personal. A 40ms RMSSD can be excellent for one person and low for another.

## Next steps

- **[Zones & TRIMP](./zones-and-trimp)** — Convert heart rate into training zones and quantify session load
- **[Advanced HRV Analysis](./advanced-hrv)** — Dive into Poincaré plots, DFA α1, and frequency-domain metrics
- **[Stress & Recovery Scoring](./stress-scoring)** — Build composite stress indices from HRV and heart rate
- **[API Reference](../reference/core-api)** — Full API documentation for all core functions
