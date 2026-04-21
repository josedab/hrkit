---
sidebar_position: 21
title: Advanced HRV Analysis
description: Poincaré plots, DFA α1, frequency-domain (LF/HF), and artifact correction.
---

# Advanced HRV Analysis

Beyond basic RMSSD and SDNN, @hrkit provides advanced HRV analysis functions: Poincaré geometry, detrended fluctuation analysis (DFA α1), frequency-domain power via Lomb-Scargle periodogram, and Lipponen-Tarvainen artifact correction. All functions are pure and zero-dependency.

## Artifact correction with cleanRR

Real-world RR data contains missed beats, extra detections, and noise. `cleanRR` applies the Lipponen-Tarvainen algorithm to identify and correct artifacts before analysis:

```typescript
import { cleanRR } from '@hrkit/core';

const raw = [810, 795, 420, 825, 800, 1610, 790, 815];

const { rr, artefactIndices } = cleanRR(raw);
// rr → cleaned intervals with artifacts corrected
// artefactIndices → [2, 5] (positions of detected artifacts)
```

You can pass optional parameters to tune detection sensitivity:

```typescript
const result = cleanRR(raw, {
  threshold: 0.2,  // deviation threshold (default)
});
```

:::tip
Always run `cleanRR` before computing advanced metrics. Even a single artifact can dramatically distort Poincaré, DFA, and frequency-domain results.
:::

## Poincaré analysis

Poincaré scatter plots graph each RR interval against the next (RR<sub>n</sub> vs RR<sub>n+1</sub>). `poincare()` returns the standard descriptors of the resulting ellipse:

```typescript
import { poincare } from '@hrkit/core';

const result = poincare(cleanedRR);
// result.sd1   → short-term variability (perpendicular to identity line)
// result.sd2   → long-term variability (along identity line)
// result.ratio → sd1 / sd2 (autonomic balance index)
```

| Metric | Reflects | Clinical use |
|--------|----------|-------------|
| **SD1** | Beat-to-beat (parasympathetic) variability | Comparable to RMSSD |
| **SD2** | Longer-term variability | Reflects overall regulation |
| **Ratio** | Autonomic balance | Lower ratio → sympathetic dominance |

## Frequency-domain analysis

`frequencyDomain()` computes spectral power using a Lomb-Scargle periodogram, which handles the uneven sampling inherent in RR interval data:

```typescript
import { frequencyDomain } from '@hrkit/core';

const fd = frequencyDomain(cleanedRR);
// fd.lf       → Low-frequency power (0.04–0.15 Hz) — mixed sympathetic/parasympathetic
// fd.hf       → High-frequency power (0.15–0.40 Hz) — parasympathetic
// fd.lfHfRatio → LF/HF ratio — sympathovagal balance indicator
// fd.vlf      → Very low-frequency power (0.003–0.04 Hz)
// fd.totalPower → Total spectral power
// fd.lfNu     → LF in normalized units
// fd.hfNu     → HF in normalized units
```

| Metric | Band | Interpretation |
|--------|------|---------------|
| **HF** | 0.15–0.40 Hz | Respiratory sinus arrhythmia (vagal tone) |
| **LF** | 0.04–0.15 Hz | Baroreflex activity (mixed ANS input) |
| **LF/HF** | — | Higher → sympathetic shift; lower → parasympathetic |

:::info
Frequency-domain analysis requires at least 2–5 minutes of clean data for reliable estimates. Short recordings will produce noisy spectral estimates.
:::

## DFA α1 (Detrended Fluctuation Analysis)

`dfaAlpha1()` computes the short-term fractal scaling exponent, which describes how heart rhythm fluctuations scale across time:

```typescript
import { dfaAlpha1 } from '@hrkit/core';

const alpha = dfaAlpha1(cleanedRR);
console.log(`DFA α1: ${alpha.toFixed(2)}`);
```

### Interpretation

| α1 value | Meaning |
|----------|---------|
| ~1.0 | Healthy fractal dynamics (complex, adaptive regulation) |
| ~1.5 | Brownian noise (loss of complexity, e.g., congestive heart failure) |
| ~0.5 | White noise (uncorrelated, random) |
| < 0.75 | Loss of fractal structure — potential clinical concern |

DFA α1 during exercise also correlates with ventilatory thresholds, making it useful for field-based threshold estimation.

## Full analysis pipeline

Combine all advanced metrics in a single pipeline using `hrvReport()`:

```typescript
import { cleanRR, hrvReport } from '@hrkit/core';

// 1. Clean raw data
const { rr: cleaned, artefactIndices } = cleanRR(rawRR);
console.log(`Corrected ${artefactIndices.length} artifacts`);

// 2. Generate full report
const report = hrvReport(cleaned);

// Time-domain
console.log(`RMSSD: ${report.rmssd.toFixed(1)} ms`);
console.log(`SDNN:  ${report.sdnn.toFixed(1)} ms`);

// Non-linear
console.log(`SD1:   ${report.poincare.sd1.toFixed(1)} ms`);
console.log(`SD2:   ${report.poincare.sd2.toFixed(1)} ms`);
console.log(`DFA α1: ${report.dfaAlpha1.toFixed(2)}`);

// Frequency-domain
console.log(`LF/HF: ${report.frequencyDomain.lfHfRatio.toFixed(2)}`);
console.log(`HF:    ${report.frequencyDomain.hf.toFixed(1)} ms²`);
```

`hrvReport()` internally calls `cleanRR`, then runs all analysis functions and bundles the results into a single `HRVReport` object. Use this when you want the complete picture; use individual functions when you only need specific metrics.

## Best practices

1. **Clean first, analyze second** — Always pass RR data through `cleanRR()` before computing advanced metrics, or use `hrvReport()` which handles this automatically.
2. **Recording length matters** — DFA α1 and frequency-domain need at least 2–5 minutes of data. Poincaré is useful with shorter recordings (≥ 1 minute).
3. **Stationary conditions** — For resting HRV, have the subject lie still. Movement introduces non-physiological variability.
4. **All functions are pure** — No internal state, no side effects. Safe to call from any context, including Web Workers and edge runtimes.

## Next steps

- **[HRV Metrics](./hrv-metrics)** — Review the RMSSD and SDNN fundamentals that advanced analysis builds on
- **[Stress & Recovery Scoring](./stress-scoring)** — Combine advanced HRV with heart rate for composite stress indices
- **[AFib Screening](./afib-screening)** — Apply rhythm analysis to detect atrial fibrillation patterns
