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
import { ModelRegistry, InferencePort } from '@hrkit/ml';

const registry = new ModelRegistry();
registry.register('zone-predictor', myOnnxModel);

const port: InferencePort = registry.get('zone-predictor');
const prediction = await port.infer({ hr: 162, rmssd: 42 });
console.log(prediction); // { zone: 4, confidence: 0.91 }
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/ml#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/ml`](https://github.com/josedab/hrkit/tree/main/packages/ml) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/ml)
