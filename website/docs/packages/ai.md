---
title: "@hrkit/ai"
description: "Agentic training planner for @hrkit — uses an LLM with structured tool calls to generate next-week workout plans as Workout DSL."
---

# @hrkit/ai

Agentic training planner for @hrkit — uses an LLM with structured tool calls to generate next-week workout plans as Workout DSL.

## Install

```bash
pnpm add @hrkit/ai
```

## Key features

- **Agentic training planner** — LLM-powered workout plan generation with structured tool calls
- **Workout DSL generation** — outputs valid `WorkoutProtocol` objects with guardrails
- **Safety constraints** — enforces intensity and volume limits to prevent overtraining

## Quick example

```typescript
import { planWeek } from '@hrkit/ai';

const plan = await planWeek({
  athleteProfile: { maxHR: 185, restHR: 48, weeklyHours: 6 },
  recentSessions: sessions,
  llm: openaiAdapter,
});

console.log(plan.workouts); // WorkoutProtocol[] for the week
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/ai#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/ai`](https://github.com/josedab/hrkit/tree/main/packages/ai) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/ai)
