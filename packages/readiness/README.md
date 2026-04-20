# @hrkit/readiness

Multi-factor recovery scoring for [@hrkit](https://github.com/josedab/hrkit) — combines HRV trend, training-load ratio (ACWR), sleep, resting-HR drift, and subjective wellness into a single 0–100 readiness score with a transparent per-component breakdown.

Zero runtime deps.

## Install

```bash
npm install @hrkit/readiness
```

## Usage

```ts
import { computeReadiness, updateBaseline, type BaselineState } from '@hrkit/readiness';

// Maintain a rolling 7-day RMSSD baseline (persist `state` across days).
let state: BaselineState = { window: [] };
const today = updateBaseline(state, 68);
state = today.state;
console.log(today.mean, today.sd); // baseline mean + standard deviation

const result = computeReadiness({
  todayRmssd: 64,
  baselineRmssd: today.mean,
  baselineSd: today.sd,        // optional — tightens the HRV band
  sleepHours: 7.5,
  restingHr: 52,
  baselineRestingHr: 54,
  atl: 85,                     // 7-day EWMA TRIMP
  ctl: 78,                     // 28-day EWMA TRIMP
  subjectiveWellness: 7,       // 1–10
});

console.log(result.score);          // 0–100
console.log(result.recommendation); // 'go_hard' | 'moderate' | 'rest'
console.log(result.components);     // { hrv, acwr, sleep, hrDrift, subjective } each 0–1
console.log(result.rationale);      // human-readable strings, ordered by importance
```

## Recommendation thresholds

| Score | Recommendation |
|-------|----------------|
| ≥ 75 | `go_hard` |
| 55 – 74 | `moderate` |
| < 55 | `rest` |

## Tuning the weights

Defaults sum to 1.0 across the most reliably-available signals. Override per-call to bias toward whatever inputs you actually collect — for example, no resting-HR sensor means you should redistribute the `hrDrift` weight:

```ts
import { computeReadiness, DEFAULT_WEIGHTS } from '@hrkit/readiness';

const result = computeReadiness(input, {
  weights: { hrDrift: 0, hrv: 0.6 }, // partial overrides; remaining defaults preserved
});
```

`DEFAULT_WEIGHTS`:

| Component | Weight | Notes |
|-----------|-------:|-------|
| `hrv` | 0.50 | Today's RMSSD vs. rolling baseline (with optional SD band) |
| `acwr` | 0.20 | Acute / chronic load ratio — penalises < 0.8 or > 1.3 |
| `sleep` | 0.15 | Hours last night |
| `hrDrift` | 0.10 | Resting HR vs. baseline |
| `subjective` | 0.05 | 1–10 wellness check-in |

The total weight does not have to sum to 1 — `computeReadiness` divides by the sum of supplied weights, so partial weight maps still produce a 0–100 score.

## API

| Symbol | Description |
|--------|-------------|
| `computeReadiness(input, opts?)` | Returns `ReadinessResult`. All inputs except `todayRmssd` and `baselineRmssd` are optional; missing components contribute `0` to that channel. |
| `updateBaseline(state, todayRmssd, windowSize?)` | Roll a new RMSSD into a 7-day (default) window. Returns `{ mean, sd, state }` — pass `state` back in tomorrow. |
| `DEFAULT_WEIGHTS` | The default `ReadinessWeights` shown above. |
| `ReadinessInput` | All optional fields documented in the type. |
| `ReadinessResult` | `{ score, recommendation, components, rationale }`. |
| `Recommendation` | `'go_hard' \| 'moderate' \| 'rest'`. |
| `BaselineState` | `{ window: number[] }`. Persist this across calls. |

## Why per-component output

`result.components` exposes each normalized 0–1 contribution so you can render a stacked bar / radar chart, or log structured data for trend analysis. `result.rationale` is the same information rendered as ordered human strings, ready to surface in a notification or coach summary.

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/readiness/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
