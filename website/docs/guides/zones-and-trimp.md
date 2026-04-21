---
sidebar_position: 2
title: Zones & TRIMP
description: 5-zone heart rate model and Bannister Training Impulse calculation.
---

# Zones & TRIMP

@hrkit provides a standard 5-zone heart rate model and Bannister's TRIMP (Training Impulse) for quantifying training load.

## Heart rate zones

### Map HR to a zone

```typescript
import { hrToZone } from '@hrkit/core';

const config = {
  maxHR: 185,
  zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number],
};

hrToZone(100, config); // → 1 (below 60%)
hrToZone(140, config); // → 3 (70–80%)
hrToZone(175, config); // → 5 (above 90%)
```

The `zones` array defines 4 thresholds as percentages of `maxHR`:

| Zone | Range | Typical effort |
|------|-------|----------------|
| 1 | below 60% maxHR | Recovery, warm-up |
| 2 | 60–70% maxHR | Easy aerobic |
| 3 | 70–80% maxHR | Moderate aerobic |
| 4 | 80–90% maxHR | Threshold / tempo |
| 5 | above 90% maxHR | VO2max / anaerobic |

### Zone distribution

Calculate how much time was spent in each zone during a session:

```typescript
import { zoneDistribution } from '@hrkit/core';

const dist = zoneDistribution(session.samples, {
  maxHR: 185,
  zones: [0.6, 0.7, 0.8, 0.9],
});

// dist.zones → { 1: seconds, 2: seconds, 3: seconds, 4: seconds, 5: seconds }
// dist.totalSeconds → total recorded time
```

:::info Gap handling
`zoneDistribution` skips intervals where consecutive samples are more than 30 seconds apart. This prevents data gaps (e.g., sensor disconnects) from inflating zone times.
:::

## TRIMP (Training Impulse)

TRIMP quantifies training load by weighting exercise duration by intensity. It uses Bannister's exponential method, which weights high-intensity work more heavily than low-intensity work.

### Calculate TRIMP for a session

```typescript
import { trimp } from '@hrkit/core';

const load = trimp(session.samples, {
  maxHR: 185,
  restHR: 48,
  sex: 'male',  // affects exponential weighting
});

console.log(`Session TRIMP: ${load.toFixed(1)}`);
```

### Sex-based weighting

The exponential weighting factor differs by sex, reflecting physiological differences in HR response:

| Setting | Factor | Source |
|---------|--------|--------|
| `'male'` | 1.92 | Bannister (1991) |
| `'female'` | 1.67 | Bannister (1991) |
| `'neutral'` | 1.80 | Average of male/female |

### Weekly training load

Aggregate TRIMP across multiple sessions:

```typescript
import { weeklyTRIMP } from '@hrkit/core';

const sessions = [session1, session2, session3];
const weekStart = new Date('2024-01-08');

const weekLoad = weeklyTRIMP(sessions, weekStart);
console.log(`Weekly TRIMP: ${weekLoad.toFixed(1)}`);
```

### Interpreting TRIMP values

TRIMP values are relative to your own fitness and training history. General guidelines for a single session:

| TRIMP | Interpretation |
|-------|---------------|
| < 50 | Light session (recovery, warm-up) |
| 50–150 | Moderate session |
| 150–300 | Hard session |
| > 300 | Very intense or very long session |

Track weekly TRIMP trends to manage training load and avoid overtraining.

:::info Gap handling
Like `zoneDistribution`, the `trimp` function skips intervals > 30 seconds to avoid distorting load calculations during data gaps.
:::

## Next steps

- **[Workout Protocols](./workout-protocols)** — Define structured workouts with zone-based targets
- **[Training Load & Insights](./training-load)** — Track ACWR, monotony, and long-term training balance
- **[HRV Metrics](./hrv-metrics)** — Complement zone data with RMSSD, SDNN, and readiness tracking
