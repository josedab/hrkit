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
- **Readiness tiers** — `go_hard` (≥ 0.95), `moderate` (≥ 0.80), `rest` (< 0.80) thresholds

## Quick example

```typescript
import { readinessScore } from '@hrkit/readiness';

const score = readinessScore({
  todayRmssd: 52,
  baselineRmssd: 55,
  sleepHours: 7.5,
});

console.log(score.tier);  // 'moderate'
console.log(score.value); // 0.87
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/readiness#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/readiness`](https://github.com/josedab/hrkit/tree/main/packages/readiness) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/readiness)
