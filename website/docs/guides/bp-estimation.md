---
sidebar_position: 16
title: Blood Pressure Estimation
description: Cuffless BP estimation from pulse transit time (PTT) with calibration support.
---

# Blood Pressure Estimation

:::danger Not a Medical Device
Blood pressure estimates are for **wellness and trend tracking ONLY**. This is NOT a medical device and **cannot replace clinical BP measurement**. Consult a healthcare professional for medical decisions. See [Disclaimers](#disclaimers-for-app-developers) below.
:::

@hrkit can estimate systolic and diastolic blood pressure from **Pulse Transit Time (PTT)** — the delay between an ECG R-peak and the corresponding peripheral pulse arrival (PPG peak). Accuracy improves significantly with per-user calibration.

## Prerequisites

BP estimation requires **simultaneous ECG and PPG data**:
- ECG source: Polar H10 (via `@hrkit/polar`) or any device with R-peak detection
- PPG source: Optical wrist/finger sensor providing pulse arrival timestamps

## Quick Start

### Step 1: Extract PTT from Aligned Signals

```typescript
import { extractPTT } from '@hrkit/core';

const ptts = extractPTT({
  rPeakTimestamps: ecgRPeaks,        // ECG R-peak times (ms)
  ppgPeakTimestamps: ppgPulseArrivals, // PPG pulse arrival times (ms)
});
// ptts: [185.2, 182.8, 187.1, ...] — PTT values in ms
```

The function pairs each R-peak with the closest subsequent PPG peak within the physiological window (50–500ms). Invalid pairs are automatically filtered.

### Step 2: Estimate Blood Pressure

```typescript
import { estimateBloodPressure } from '@hrkit/core';

const bp = estimateBloodPressure(ptts);
if (bp) {
  console.log(`${bp.systolic}/${bp.diastolic} mmHg`);
  console.log(`MAP: ${bp.map} mmHg`);
  console.log(`Confidence: ${bp.confidence}`);
  console.log(bp.disclaimer); // always display to users
}
```

### Step 3: Calibrate for Better Accuracy

Provide a known cuff reading to dramatically improve accuracy:

```typescript
const bp = estimateBloodPressure(ptts, {
  systolic: 120,      // known cuff reading
  diastolic: 80,
  ptt: 200,           // PTT measured at calibration time
  timestamp: Date.now(),
});
// Calibrated estimates are anchored to the cuff reference
```

## How PTT Works

```
ECG R-Peak → Blood ejected → Pulse arrives at wrist → PTT measured
     ↑                                                      ↑
   t₁ (ms)                                               t₂ (ms)
                    PTT = t₂ - t₁
```

**Key relationship:** Higher blood pressure → stiffer arteries → faster pulse wave → shorter PTT.

The SDK uses a log-linear model (Mukkamala et al.): `SBP = a × ln(PTT) + b`, where coefficients are calibration-derived or use population defaults.

## Result Structure

```typescript
interface BPEstimate {
  systolic: number;      // mmHg
  diastolic: number;     // mmHg
  map: number;           // Mean Arterial Pressure
  ptt: number;           // median PTT used (ms)
  confidence: number;    // 0–1
  calibrated: boolean;   // whether calibration was used
  timestamp: number;
  disclaimer: string;    // always present
}
```

## Confidence Factors

| Factor | Effect on Confidence |
|--------|---------------------|
| Calibration provided | +0.3 |
| ≥ 20 PTT values | +0.1 |
| ≥ 50 PTT values | +0.2 |
| Low PTT variance | +0.0 (no penalty) |
| High PTT variance (CV > 15%) | -0.1 |

## Disclaimers for App Developers

:::warning Required for Any App Using This Feature
1. **Display the disclaimer** — every `BPEstimate` includes a `disclaimer` field. Always show it.
2. **Do not use clinical language** — say "estimated blood pressure" not "blood pressure reading."
3. **Require calibration** for any health-tracking use — uncalibrated estimates are for demonstration only.
4. **Re-calibrate periodically** — PTT-to-BP relationship drifts with hydration, posture, and time.
5. **Do not replace clinical devices** — this cannot substitute for a validated sphygmomanometer.
6. **Not FDA-cleared** — this feature has not been submitted for regulatory clearance.
:::

## Limitations

- **Requires two synchronized sensors** — ECG (chest) + PPG (wrist/finger)
- **Calibration drifts** — re-calibrate daily or after posture changes
- **Motion artifact** — only reliable at rest or low activity
- **Population model** — uncalibrated defaults are trained on average adults; may not suit all demographics
- Returns `null` if PTT values are empty or outside physiological range (50–500ms)

## Next steps

- **[AFib Screening](./afib-screening)** — Detect rhythm irregularities from RR intervals
- **[Stress & Recovery Scoring](./stress-scoring)** — Combine cardiovascular signals into a composite stress index
