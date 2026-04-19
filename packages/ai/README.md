# @hrkit/ai

Agentic training planner for [@hrkit](https://github.com/josedab/hrkit). Turns an `AthleteStore` of historical sessions + HRV trends + training-load curves into a structured next-week plan, expressed as compilable Workout DSL strings.

The LLM is only ever asked to emit DSL strings via tool calls — every returned session is parsed through `@hrkit/core`'s `parseWorkoutDSL` before being handed back, so you cannot get free-form prose into your scheduler.

## Install

```bash
npm install @hrkit/ai @hrkit/coach
```

`@hrkit/coach` provides the `LLMProvider` interface and the OpenAI / Anthropic / Ollama adapters.

## Quick Start

```ts
import { planNextWeek } from '@hrkit/ai';
import { OpenAIProvider } from '@hrkit/coach';

const plan = await planNextWeek({
  store: athleteStore, // any @hrkit/core AthleteStore
  goal: '70.3 in 12 weeks — build phase, base aerobic and threshold focus',
  daysAhead: 7,
  llm: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o-mini' }),
  guardrails: {
    maxZ5MinutesPerSession: 12,
    maxSessionsPerWeek: 6,
    minRestSeconds: 30,
  },
});

for (const s of plan.sessions) {
  console.log(`Day ${s.day}: ${s.rationale}`);
  console.log(s.dsl);          // raw Workout DSL string
  console.log(s.protocol);     // already parsed via parseWorkoutDSL
}

if (plan.warnings.length > 0) console.warn('planner warnings:', plan.warnings);
```

## Architecture — three layers, all exported

```
AthleteStore  ──► PlannerTools  ──► AthleteSnapshot  ──► LLM (tool calls) ──► PlannedSession[]
   raw data       function shim     numeric summary       guarded DSL output     parsed WorkoutProtocol
```

You can use any layer independently — for example, build an `AthleteSnapshot` for your own custom prompt, or wire `makeTools` into a different agent framework.

| Symbol | Description |
|--------|-------------|
| `planNextWeek(input)` | Top-level entry point. Builds a snapshot, calls the LLM with structured tool definitions, parses each emitted DSL through `parseWorkoutDSL`, applies guardrails. |
| `makeTools(store)` | Returns a `PlannerTools` shim that enforces sane bounds (`getRecentSessions` capped at 50, trend window 1–180 days). |
| `buildSnapshot(tools, opts?)` | Returns an `AthleteSnapshot` — recent sessions, HRV trend, training load, rMSSD baseline, ACWR, week TRIMP. |
| `PlannerInput` | `{ store, goal, daysAhead?, llm, guardrails? }`. |
| `PlanGuardrails` | `{ maxZ5MinutesPerSession?, maxSessionsPerWeek?, minRestSeconds? }`. |
| `PlannedSession` | `{ day, rationale, dsl, protocol }`. |
| `PlannerOutput` | `{ goal, snapshot, sessions, warnings }`. |
| `AthleteSnapshot` | Numeric summary fed into the LLM prompt (no PII). |

## Why parse the DSL on the way out?

LLMs hallucinate. The `WorkoutDSL` parser in `@hrkit/core` is the safety net:

- A session that fails to parse is dropped from `plan.sessions` and a `warnings` entry is appended.
- All zone numbers, durations, and structures are validated before they reach your scheduler.
- The LLM can only express ideas the rest of the SDK already knows how to execute.

## Bring your own LLM

`PlannerInput.llm` accepts any `LLMProvider` from `@hrkit/coach` — including a mock one for tests:

```ts
import type { LLMProvider } from '@hrkit/coach';

const fakeLLM: LLMProvider = {
  name: 'fake',
  async complete() {
    return JSON.stringify({
      sessions: [{ day: 1, rationale: 'easy aerobic', dsl: 'warmup 10m z1\nz2 40m\ncooldown 10m z1' }],
    });
  },
};
```

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/ai/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
