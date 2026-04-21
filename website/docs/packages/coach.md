---
title: "@hrkit/coach"
description: "AI coaching layer for @hrkit — deterministic rule-engine summaries + LLM adapters (OpenAI/Anthropic/Ollama)"
---

# @hrkit/coach

AI coaching layer for @hrkit — deterministic rule-engine summaries + LLM adapters (OpenAI/Anthropic/Ollama)

## Install

```bash
pnpm add @hrkit/coach
```

## Key features

- **Rule-engine summaries** — deterministic session analysis without an LLM
- **LLM adapters** — OpenAI, Anthropic, and Ollama connectors for richer feedback
- **Workout cues** — real-time coaching prompts during active sessions

## Quick example

```typescript
import { coachSummary } from '@hrkit/coach';

const session = { /* ... recorded session data ... */ };
const summary = coachSummary(session, {
  maxHR: 185,
  restHR: 48,
});

console.log(summary.text);
// "Solid aerobic session — 62% of time in Zone 2. Consider adding
//  short Zone 4 intervals next time for cardiac output gains."
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/coach#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/coach`](https://github.com/josedab/hrkit/tree/main/packages/coach) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/coach)
