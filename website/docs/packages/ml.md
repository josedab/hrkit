---
title: "@hrkit/ml"
description: "Pluggable machine-learning inference for @hrkit — InferencePort, model registry, deterministic baseline models. Bring-your-own ONNX / TF.js runtime."
---

# @hrkit/ml

Pluggable machine-learning inference for @hrkit — InferencePort, model registry, deterministic baseline models. Bring-your-own ONNX / TF.js runtime.

## Install

```bash
pnpm add @hrkit/ml
```

## Key features

- **InferencePort** — pluggable inference interface for any ML runtime
- **Model registry** — register and discover models by name and version
- **BYO runtime** — bring your own ONNX Runtime or TensorFlow.js backend
- **Deterministic baselines** — built-in rule-based models for comparison

## Quick example

```typescript
import { ModelRegistry, type InferencePort } from '@hrkit/ml';

type Input = { hr: number; maxHR: number };
type Output = { zone: number };
const zonePredictor: InferencePort<Input, Output> = {
  modelId: 'zone-predictor',
  version: '1.0.0',
  modalities: ['hr'],
  async predict({ hr, maxHR }) {
    return { zone: Math.min(5, Math.max(1, Math.ceil((hr / maxHR) * 5))) };
  },
};
const registry = new ModelRegistry();
registry.register(zonePredictor);

const port = registry.get<Input, Output>('zone-predictor');
const prediction = await port?.predict({ hr: 162, maxHR: 185 });
console.log(prediction); // { zone: 5 }
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/ml#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/ml`](https://github.com/josedab/hrkit/tree/main/packages/ml) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/ml)
