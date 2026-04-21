# ADR 0009: Workout DSL for Protocol Definition

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** @hrkit maintainers

## Context

The `WorkoutEngine` executes structured workouts defined as
`WorkoutProtocol` objects — arrays of steps with durations, types, and
HR targets. Building these objects in code is verbose and error-prone:

```ts
const protocol: WorkoutProtocol = {
  name: 'Tabata',
  steps: [
    { name: 'Warmup', type: 'warmup', durationSec: 300, target: { zone: 2 } },
    { name: 'Work', type: 'work', durationSec: 20, target: { zone: 5 } },
    { name: 'Rest', type: 'rest', durationSec: 10, target: { zone: 1 } },
    // ... 7 more work/rest pairs
  ],
};
```

We need a way for coaches, athletes, and AI agents to define protocols
concisely — editable as text, storable as strings, and parseable back to
typed `WorkoutProtocol` objects.

## Decision

We define a line-based DSL in `packages/core/src/workout-dsl.ts`:

```
name: Tabata
warmup 5m @zone 2
repeat 8
  work 20s @zone 5
  rest 10s @zone 1
end
cooldown 5m @zone 1
```

Grammar:

- `name: <string>` — protocol name
- `desc: <string>` — optional description
- `warmup|work|rest|cooldown <duration> [@zone N | @hr MIN-MAX]`
- `repeat <N> ... end` — repeat a block N times
- `#` — line comments
- Duration: `30s`, `5m`, `1h30m`, or bare seconds (`90`)

Two functions mediate between text and typed objects:

- `parseWorkoutDSL(text: string): WorkoutProtocol`
- `workoutToDSL(protocol: WorkoutProtocol): string`

A `PROTOCOL_LIBRARY` dictionary ships four pre-built protocols as DSL
strings: `TABATA`, `NORWEGIAN_4X4`, `MAF_45`, `BJJ_ROUNDS`.

A `WorkoutCues` class generates spoken coaching cues from a protocol
for text-to-speech integration.

## Consequences

### Positive

- Protocols are human-readable and editable as text (coachable format).
- Round-trip fidelity: `parseWorkoutDSL(workoutToDSL(p))` reconstructs
  the original protocol.
- AI/LLM agents can generate workout plans as text strings with
  guardrails (the parser validates structure).
- The `PROTOCOL_LIBRARY` gives users working examples without reading
  documentation.
- `repeat N ... end` blocks keep repetitive protocols compact.

### Negative

- The DSL is custom syntax — no existing tooling (syntax highlighting,
  linting) exists for it.
- `repeat` blocks do not nest (single level only). This limits
  expressiveness but keeps the parser simple.
- Duration parsing is permissive (`90` is seconds, `90s` is also
  seconds) which could cause confusion.

## Alternatives Considered

1. **JSON/YAML configuration** — rejected: verbose, not
  human-friendly for coaches. A 8-round Tabata in JSON is 50+ lines
  vs 6 lines in the DSL.

2. **Builder pattern** (`protocol().warmup(5m).work(20s)...build()`) —
  rejected: requires code, can't be stored as a string, not suitable
  for AI-generated plans.

3. **Existing workout format (FIT SDK workout)** — rejected: binary
  format tied to Garmin ecosystem, not human-readable, requires a
  separate SDK to parse.

## References

- Source: `packages/core/src/workout-dsl.ts`
- Tests: `packages/core/src/__tests__/workout-dsl.test.ts`
- Protocol engine: `packages/core/src/workout-protocol.ts`
- AI consumer: `packages/ai/src/index.ts` (generates DSL strings)
- Training plan: `packages/core/src/training-plan.ts` (stores DSL per
  day)
