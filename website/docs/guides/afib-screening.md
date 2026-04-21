---
sidebar_position: 15
title: AFib Screening
description: Rhythm irregularity detection from RR intervals — screening tool with mandatory disclaimers.
---

# AFib Screening

:::danger Not a Medical Device
This is a **screening tool only**. It **cannot diagnose** atrial fibrillation or any cardiac condition. Always advise users to consult a qualified healthcare professional for medical evaluation. See [Disclaimers](#disclaimers-for-app-developers) below.
:::

@hrkit can detect rhythm irregularity patterns from RR interval data using four validated statistical methods. The output is a classification (`normal`, `irregular`, or `inconclusive`) with a confidence score.

## Quick Start

```typescript
import { screenForAFib } from '@hrkit/core';

// Requires 60+ RR intervals (~1 minute of data)
const result = screenForAFib(session.rrIntervals);

console.log(result.classification); // 'normal' | 'irregular' | 'inconclusive'
console.log(result.confidence);     // 0–1
console.log(result.disclaimer);     // always present — display to users
```

## Detection Methods

The screening combines four independent metrics:

| Method | What It Measures | Irregular Signal |
|--------|-----------------|------------------|
| **Shannon Entropy** | Randomness of ΔRR histogram | High entropy (> 3.0 bits) |
| **Poincaré SD1/SD2** | Short vs long-term variability ratio | SD1/SD2 > 0.6 |
| **Coefficient of Variation** | RR interval variability | CV > 15% |
| **Turning Point Ratio** | Randomness test on successive differences | Deviation from 0.667 |

Each metric scores 0–1. The ensemble average drives the classification:
- **> 0.7** → `irregular` (possible rhythm disturbance)
- **< 0.35** → `normal` (regular sinus rhythm)
- **0.35–0.7** → `inconclusive` (insufficient signal)

## Using Individual Metrics

Access the underlying algorithms directly:

```typescript
import { shannonEntropyRR, poincareDescriptors, turningPointRatio } from '@hrkit/core';

const entropy = shannonEntropyRR(rrIntervals);
const { sd1, sd2 } = poincareDescriptors(rrIntervals);
const tpr = turningPointRatio(rrIntervals);

console.log(`Entropy: ${entropy} bits`);
console.log(`Poincaré: SD1=${sd1}ms, SD2=${sd2}ms, ratio=${(sd1/sd2).toFixed(2)}`);
console.log(`Turning point ratio: ${tpr}`);
```

## Configuration

Adjust thresholds for your population:

```typescript
const result = screenForAFib(rrIntervals, {
  minSamples: 120,           // require 2+ minutes of data
  entropyThreshold: 3.5,     // stricter entropy cutoff
  sd1sd2Threshold: 0.7,      // stricter Poincaré cutoff
  cvThreshold: 18,           // stricter CV cutoff
});
```

## Result Structure

```typescript
interface AFibScreeningResult {
  classification: 'normal' | 'irregular' | 'inconclusive';
  confidence: number;          // 0–1
  shannonEntropy: number;      // bits
  sd1: number;                 // Poincaré SD1 (ms)
  sd2: number;                 // Poincaré SD2 (ms)
  sd1sd2Ratio: number;
  rrCoefficientOfVariation: number;  // %
  turningPointRatio: number;
  sampleCount: number;
  disclaimer: string;          // always present
}
```

## Disclaimers for App Developers

:::warning Required for Any App Using This Feature
If you integrate AFib screening into your application, you **must**:

1. **Display the disclaimer** — every `AFibScreeningResult` includes a `disclaimer` field. Show it to users before and after screening.
2. **Do not use diagnostic language** — say "rhythm irregularity detected" not "atrial fibrillation detected."
3. **Recommend clinical follow-up** — direct users to see a doctor if any irregularity is found.
4. **Do not replace medical devices** — this screening cannot substitute for an ECG, Holter monitor, or clinical evaluation.
5. **Validate for your population** — accuracy varies by age, fitness level, and sensor quality.
:::

### Suggested User-Facing Copy

```
⚠️ This is a screening tool and is NOT a medical device.
It cannot diagnose atrial fibrillation or any cardiac condition.
If a rhythm irregularity is detected, please consult your doctor
for a proper medical evaluation.
```

## Limitations

- **Minimum data**: 60 RR intervals (~1 minute). Longer recordings (3–5 min) are more reliable.
- **Sensor quality**: Optical wrist sensors produce noisier RR data than chest straps. Use a chest strap for screening.
- **Exercise**: Screen at rest only — exercise naturally alters rhythm variability.
- **False positives**: Ectopic beats (PVCs, PACs) can trigger `irregular` classification.
- **False negatives**: Paroxysmal AF may not be present during the recording window.
- **Not FDA-cleared**: This feature has not been submitted for regulatory clearance.

## Next steps

- **[Blood Pressure Estimation](./bp-estimation)** — Explore cuffless BP from pulse transit time
- **[Advanced HRV Analysis](./advanced-hrv)** — Use Poincaré and DFA α1 to complement rhythm screening
- **[HRV Metrics](./hrv-metrics)** — Review the RR interval fundamentals behind irregularity detection
