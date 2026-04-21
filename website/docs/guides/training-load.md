---
sidebar_position: 23
title: Training Load & Insights
description: ACWR, monotony, TSB, and AI-free training recommendations.
---

# Training Load & Insights

@hrkit includes a pure, rule-based training analysis engine — no ML, no cloud, no API keys. It tracks acute and chronic training load, computes risk metrics, and produces actionable recommendations from your session history.

## Athlete store

`InMemoryAthleteStore` is a local session store that maintains rolling training-load and HRV trends:

```typescript
import { InMemoryAthleteStore } from '@hrkit/core';

const store = new InMemoryAthleteStore();
```

### Saving sessions

After recording a session, save it to the store to build your training history:

```typescript
const sessionId = store.saveSession(completedSession);
```

### Training load trend

Retrieve daily training load over a rolling window:

```typescript
const trend = store.getTrainingLoadTrend(28); // last 28 days
// Each point: { date, load, atl, ctl, tsb, acwr }
```

| Field | Meaning |
|-------|---------|
| **ATL** | Acute Training Load — 7-day exponential moving average (fatigue) |
| **CTL** | Chronic Training Load — 28-day exponential moving average (fitness) |
| **TSB** | Training Stress Balance — CTL minus ATL (form) |
| **ACWR** | Acute:Chronic Workload Ratio — ATL / CTL (injury risk) |

### HRV trend

Track daily HRV for readiness analysis:

```typescript
const hrvTrend = store.getHRVTrend(14); // last 14 days
// Each point: { date, rmssd }
```

### Current ACWR

Get the latest acute-to-chronic workload ratio:

```typescript
const acwr = store.getCurrentACWR();
// null if insufficient data, otherwise a number (ideal: 0.8–1.3)
```

## ACWR risk assessment

Evaluate injury risk from the current workload ratio:

```typescript
import { assessACWRRisk } from '@hrkit/core';

const risk = assessACWRRisk(1.4);
// → 'high'
```

| ACWR | Risk level | Guidance |
|------|-----------|----------|
| > 1.5 | `'critical'` | Very high injury risk — reduce load immediately |
| > 1.3 | `'high'` | Elevated risk — scale back intensity |
| 0.8–1.3 | `'optimal'` | Sweet spot for adaptation |
| < 0.8 | `'undertrained'` | Insufficient stimulus — increase load gradually |

The threshold constants are exported for custom logic:

```typescript
import { ACWR_CRITICAL } from '@hrkit/core';
// ACWR_CRITICAL = 1.5
```

## HRV trend analysis

Detect shifts in autonomic readiness from recent HRV data:

```typescript
import { analyzeHRVTrend } from '@hrkit/core';

const analysis = analyzeHRVTrend(hrvTrend);
// analysis.direction → 'improving' | 'declining' | 'stable'
// analysis.magnitude → size of change
// analysis.concern   → boolean flag if trend is worrying
```

## Training monotony

Monotony measures how repetitive your training load is. High monotony with high load increases overtraining risk:

```typescript
import { calculateMonotony } from '@hrkit/core';

const monotony = calculateMonotony(loadTrend);
// monotony > 2.0 → training is too uniform, vary intensity
```

```typescript
import { MONOTONY_HIGH } from '@hrkit/core';
// MONOTONY_HIGH = 2.0
```

## Training recommendations

`getTrainingRecommendation()` synthesizes all of the above into a single actionable recommendation:

```typescript
import { getTrainingRecommendation } from '@hrkit/core';

const rec = getTrainingRecommendation({
  trainingLoad: store.getTrainingLoadTrend(28),
  hrvTrend: store.getHRVTrend(14),
  acwr: store.getCurrentACWR(),
});

console.log(rec.verdict);      // 'go_hard' | 'moderate' | 'rest' | 'deload'
console.log(rec.riskLevel);    // 'low' | 'moderate' | 'high' | 'critical'
console.log(rec.prescription); // human-readable training suggestion
console.log(rec.reasons);      // array of contributing factors
console.log(rec.confidence);   // 0–1 confidence score
```

## Full workflow example

```typescript
import {
  InMemoryAthleteStore,
  getTrainingRecommendation,
  assessACWRRisk,
  calculateMonotony,
} from '@hrkit/core';

// 1. Build training history
const store = new InMemoryAthleteStore();
store.saveSession(mondaySession);
store.saveSession(tuesdaySession);
store.saveSession(wednesdaySession);

// 2. Check current load status
const acwr = store.getCurrentACWR();
if (acwr !== null) {
  const risk = assessACWRRisk(acwr);
  console.log(`ACWR: ${acwr.toFixed(2)} → risk: ${risk}`);
}

// 3. Check monotony
const monotony = calculateMonotony(store.getTrainingLoadTrend(7));
console.log(`Monotony: ${monotony.toFixed(2)}`);

// 4. Get recommendation
const rec = getTrainingRecommendation({
  trainingLoad: store.getTrainingLoadTrend(28),
  hrvTrend: store.getHRVTrend(14),
  acwr,
});

console.log(`Today: ${rec.verdict} (${rec.riskLevel} risk)`);
console.log(rec.prescription);
rec.reasons.forEach((r) => console.log(`  • ${r}`));
```

:::info Key constants
| Constant | Value | Meaning |
|----------|-------|---------|
| `ACWR_CRITICAL` | 1.5 | ACWR above this → critical injury risk |
| `MONOTONY_HIGH` | 2.0 | Monotony above this → training too uniform |
| `TSB_DELOAD_THRESHOLD` | -20 | TSB below this → accumulated fatigue, consider deload |
:::

## Next steps

- **[Training Plans](./training-plans)** — Build multi-week periodized plans informed by load data
- **[Workout Protocols](./workout-protocols)** — Define structured workouts that feed load calculations
- **[VO2max & Fitness Scoring](./vo2max)** — Track aerobic fitness alongside training load trends
