---
sidebar_position: 14
title: Stress & Recovery Scoring
description: Composite stress index from HRV, heart rate, breathing rate, and recovery state.
---

# Stress & Recovery Scoring

@hrkit computes a real-time composite stress score (0–100) by combining multiple physiological signals. Higher score = higher stress.

## Quick Start

```typescript
import { computeStress } from '@hrkit/core';

const result = computeStress({
  rrIntervals: recentRR,      // last 30+ RR intervals
  currentHR: 72,              // current heart rate
  restHR: 60,                 // known resting HR
  baselineRmssd: 45,          // optional: 7-day rMSSD baseline
  subjectiveWellness: 7,      // optional: 1-10 self-report
});

console.log(result.score);  // 0–100
console.log(result.level);  // 'low' | 'moderate' | 'high' | 'very_high'
```

## How It Works

The score combines four components, each scored 0–100 independently, then weighted:

| Component | Weight | What It Measures | Low Score Means |
|-----------|--------|------------------|-----------------|
| HRV (rMSSD) | 35% | Parasympathetic tone | High HRV → relaxed |
| Heart Rate | 25% | Sympathetic activation | HR near resting → calm |
| Breathing Rate | 20% | Respiratory drive | Slow breathing → relaxed |
| Recovery | 15% | Today vs baseline HRV | Well recovered |
| Subjective | 5% | Self-reported wellness | Feeling good |

Recovery and subjective components are only included if you provide the optional inputs. Weights redistribute automatically if they're absent.

## Breathing Rate Extraction

The SDK estimates breathing rate from RR interval modulation (respiratory sinus arrhythmia):

```typescript
import { estimateBreathingRate } from '@hrkit/core';

const bpm = estimateBreathingRate(rrIntervals);
if (bpm) {
  console.log(`Breathing: ${bpm} breaths/min`);
  // Optimal for HRV: 6–12 bpm (coherent breathing)
}
```

Returns `null` if the RR data is insufficient (< 30 intervals) or the breathing signal is too weak to detect.

## Stress Levels

| Score | Level | Interpretation |
|-------|-------|----------------|
| 0–29 | Low | Relaxed, parasympathetic dominant |
| 30–54 | Moderate | Normal daily activity |
| 55–74 | High | Elevated stress or exercise |
| 75–100 | Very High | Intense exertion or acute stress |

## Custom Weights

Override the default weights for your use case:

```typescript
const result = computeStress(input, {
  hrv: 0.5,            // emphasize HRV
  heartRate: 0.2,
  breathingRate: 0.2,
  recovery: 0.1,
  subjective: 0,       // ignore subjective
});
```

## Real-Time Dashboard Usage

Compute stress on a rolling window of recent data:

```typescript
import { computeStress } from '@hrkit/core';

const WINDOW_SIZE = 60; // last 60 RR intervals
const recentRR: number[] = [];

for await (const packet of conn.heartRate()) {
  recentRR.push(...packet.rrIntervals);
  if (recentRR.length > WINDOW_SIZE) recentRR.splice(0, recentRR.length - WINDOW_SIZE);

  const stress = computeStress({
    rrIntervals: recentRR,
    currentHR: packet.hr,
    restHR: 60,
  });

  updateDashboard(stress.score, stress.level);
}
```

## Per-Component Breakdown

Access individual components for detailed views:

```typescript
console.log(result.components.hrv);           // 0–100
console.log(result.components.heartRate);      // 0–100
console.log(result.components.breathingRate);  // 0–100
console.log(result.components.recovery);       // 0–100 or null
console.log(result.components.subjective);     // 0–100 or null
console.log(result.breathingRateBPM);          // breaths/min or null
console.log(result.rmssd);                     // session rMSSD
```
