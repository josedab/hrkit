---
sidebar_position: 13
title: VO2max & Fitness Scoring
description: Estimate VO2max from heart rate data and compute age/sex-normalized fitness percentiles.
---

# VO2max & Fitness Scoring

VO2max (maximal oxygen uptake) is the gold-standard measure of aerobic fitness. Lab testing requires expensive equipment, but @hrkit provides three field-estimation methods that work from heart rate data alone.

## Estimation Methods

### 1. Uth Formula (resting + max HR)

The simplest method — requires only resting and maximum heart rate:

```typescript
import { estimateVO2maxUth } from '@hrkit/core';

const est = estimateVO2maxUth(185, 55); // maxHR=185, restHR=55
console.log(est.vo2max);     // ~51.5 ml/kg/min
console.log(est.confidence); // 0.85
console.log(est.ciLower);    // ~44.6
console.log(est.ciUpper);    // ~58.4
```

**When to use:** Quick estimate from known resting HR. Best for trained individuals. Typical error: ±3.5 ml/kg/min.

### 2. Session-Based (HR drift during exercise)

Uses heart rate data from a steady-state aerobic session:

```typescript
import { estimateVO2maxFromSession } from '@hrkit/core';

const est = estimateVO2maxFromSession({
  hrSamples: steadyStateHR,  // Array of HR values
  durationMin: 20,           // Session length
  restHR: 55,
  maxHR: 185,
});

if (est) {
  console.log(`VO2max: ${est.vo2max} ml/kg/min`);
}
```

**When to use:** After an aerobic run or ride at moderate intensity (50–85% HRR). Requires ≥10 minutes of data. Returns `null` if the session isn't suitable (too short or wrong intensity).

### 3. Cooper Test (12-minute run distance)

Classic field test — how far can you run in 12 minutes?

```typescript
import { estimateVO2maxCooper } from '@hrkit/core';

const est = estimateVO2maxCooper(2400); // 2.4km in 12 minutes
console.log(est.vo2max); // ~42.4 ml/kg/min
```

**When to use:** Dedicated test sessions. Most accurate field method but requires all-out effort.

## Which Method to Choose

| Method | Input Needed | Accuracy | Best For |
|--------|-------------|----------|----------|
| Uth | Resting HR + max HR | ±3.5 | Quick estimate, daily tracking |
| Session | 10+ min aerobic session | ±4.0 | Trend tracking from workouts |
| Cooper | 12-min max-effort run | ±3.4 | Periodic fitness testing |

## Fitness Percentile Scoring

Convert any VO2max estimate into an age- and sex-normalized fitness score using ACSM reference tables:

```typescript
import { fitnessScore } from '@hrkit/core';

const score = fitnessScore(48, 30, 'male');
// {
//   vo2max: 48,
//   percentile: 78,
//   category: 'excellent',
//   ageGroup: '30-39',
//   sex: 'male'
// }
```

### Categories

| Percentile | Category |
|-----------|----------|
| < 10th | Very Poor |
| 10–24th | Poor |
| 25–49th | Fair |
| 50–74th | Good |
| 75–89th | Excellent |
| ≥ 90th | Superior |

## Confidence Intervals

All estimates include 95% confidence intervals. Display them to set expectations:

```typescript
const est = estimateVO2maxUth(185, 55);
console.log(`VO2max: ${est.vo2max} (${est.ciLower}–${est.ciUpper}) ml/kg/min`);
// "VO2max: 51.5 (44.6–58.4) ml/kg/min"
```

## Limitations

- Field estimates are **less precise** than lab-based VO2max tests (±3–5 ml/kg/min)
- The Uth formula is validated for **trained individuals** — less accurate for sedentary populations
- Session-based estimation requires **steady-state aerobic** exercise (not intervals or HIIT)
- All methods require accurate **maxHR** and **restHR** — use measured values, not age-based formulas

## Next steps

- **[Stress & Recovery Scoring](./stress-scoring)** — Combine VO2max with HRV for composite readiness scores
- **[Training Load & Insights](./training-load)** — Use fitness estimates to guide long-term load management
- **[HRV Metrics](./hrv-metrics)** — Pair VO2max tracking with daily RMSSD and readiness verdicts
