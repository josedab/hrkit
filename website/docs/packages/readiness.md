---
title: "@hrkit/readiness"
description: "Readiness scoring for @hrkit — adaptive HRV baseline + multi-factor recovery model."
---

# @hrkit/readiness

Readiness scoring for @hrkit — adaptive HRV baseline + multi-factor recovery model.

## Install

```bash
pnpm add @hrkit/readiness
```

## Key features

- **Adaptive HRV baseline** — rolling baseline that adjusts to an athlete's training load
- **Multi-factor recovery scoring** — combines HRV, sleep, subjective readiness, and training history
- **Readiness recommendations** — `go_hard` (score ≥ 75), `moderate` (55–74), or `rest` (< 55)

## Quick example

```typescript
import { computeReadiness } from '@hrkit/readiness';

const result = computeReadiness({
  todayRmssd: 52,
  baselineRmssd: 55,
  sleepHours: 7.5,
});

console.log(result.recommendation); // 'go_hard' | 'moderate' | 'rest'
console.log(result.score);          // 0–100
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/readiness#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/readiness`](https://github.com/josedab/hrkit/tree/main/packages/readiness) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/readiness)
