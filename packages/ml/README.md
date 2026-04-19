# @hrkit/ml

Pluggable ML inference for [@hrkit](https://github.com/josedab/hrkit). Defines a stable `InferencePort<I, O>` contract so application code can swap deterministic baselines for ONNX / TF.js models without touching call sites.

## Why a separate package

ML models need their own runtime (`onnxruntime-web`, `@tensorflow/tfjs`) and dataset-licensing concerns. Keeping them out of `@hrkit/core` preserves the **zero-dependency** promise of the core and lets model versioning move independently of the SDK.

> ⚠️ Built-in models are research-grade unless explicitly marked otherwise. Never use for clinical diagnosis — see the `intendedUse` field on each model card.

## Install

```bash
npm install @hrkit/ml
```

## What's in the box

- **`InferencePort<I, O>`** — minimal async interface every model implements.
- **`ModelRegistry`** — version-pinned lookup with model cards.
- **`lactateThresholdBaseline`** — Conconi-style HR/power deflection-point estimator.
- **`fatigueBaseline`** — RMSSD trend + resting-HR drift fatigue score.

## Usage

```ts
import {
  ModelRegistry,
  fatigueBaseline,
  lactateThresholdBaseline,
} from '@hrkit/ml';

const registry = new ModelRegistry();
registry.register(fatigueBaseline, { description: 'rMSSD + RHR linear blend' });
registry.register(lactateThresholdBaseline);

// Look up the latest version of a model id…
const fatigue = registry.get<typeof fatigueBaseline.predict extends (i: infer I) => Promise<infer O> ? I : never, never>('fatigue-baseline');
const out = await fatigue!.predict({ rmssdSeries: [...], restingHrSeries: [...] });
console.log(out.score, out.band, out.notes);

// …or pin to an exact version (recommended in production):
const lt = registry.get('lactate-threshold-baseline', '1.0.0');

// Surface model cards for consent UIs / audit logs:
console.table(registry.cardList());
```

## Implementing a custom model

```ts
import type { InferencePort } from '@hrkit/ml';

const myZoneClassifier: InferencePort<{ hr: number; maxHR: number }, { zone: number }> = {
  modelId: 'my-zone-classifier',
  version: '0.1.0',
  modalities: ['hr'],
  intendedUse: 'wellness',
  async predict({ hr, maxHR }) {
    return { zone: Math.min(5, Math.max(1, Math.ceil((hr / maxHR) * 5))) };
  },
};

registry.register(myZoneClassifier);
```

## API

| Symbol | Description |
|--------|-------------|
| `InferencePort<I, O>` | Contract: `modelId`, `version`, `modalities`, optional `intendedUse`, async `predict(input)`. |
| `ModelCard` | Discoverable metadata `{ modelId, version, modalities, intendedUse, description?, reference? }`. |
| `ModelRegistry.register(model, card?)` | Throws if `id@version` already registered (defensive against accidental overrides). |
| `ModelRegistry.get(id, version?)` | Returns exact match for `version`, or the highest-semver match if omitted. `undefined` if not found. |
| `ModelRegistry.cardList()` | All registered cards. |
| `ModelRegistry.size` | Number of registered models. |
| `lactateThresholdBaseline` | Returns `{ ltWatts, ltHr, rSquared, confident }`. Needs `samples: { powerWatts, hr }[]`. |
| `fatigueBaseline` | Returns `{ score (0–1), band, notes[] }`. Needs `rmssdSeries[]` + `restingHrSeries[]`. |

## Why version-pinning matters

Silently auto-upgrading an ML model is a recipe for hard-to-debug regressions, especially inside a coaching loop where downstream recommendations cascade. `ModelRegistry.get(id, version)` enforces an exact match; the unversioned form is only convenient for prototyping.

## License

MIT
