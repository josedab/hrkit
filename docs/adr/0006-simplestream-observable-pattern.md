# ADR 0006: SimpleStream Observable Pattern

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

Multiple modules across `@hrkit/core` need to push real-time values to
consumers: `SessionRecorder` emits `hr$` and `zone$`, `WorkoutEngine`
emits `step$` and `target$`, `MultiDeviceManager` emits `fused$`, and
`GroupSession` emits `athletes$`, `heatmap$`, and `stats$`.

The obvious choice is RxJS (`BehaviorSubject`), but that would add a
~200 kB dependency to a package whose design is zero-dependency. An
`EventEmitter` would lose the "emit current value to new subscribers"
guarantee that UI frameworks rely on (e.g., a React component that mounts
mid-session must see the latest HR immediately, not wait for the next
beat).

## Decision

We implement a minimal `SimpleStream<T>` class (62 lines) in
`packages/core/src/stream.ts` with BehaviorSubject-like semantics:

```ts
class SimpleStream<T> implements ReadableStream<T> {
  subscribe(listener: (value: T) => void): Unsubscribe;
  get(): T | undefined;
  emit(value: T): void;
}
```

Key properties:

- **Last-value replay**: new subscribers immediately receive the current
  value, so UI components never show stale/empty state.
- **Error isolation**: a throwing subscriber does not crash other
  listeners (try/catch around each listener invocation).
- **No backpressure, no operators**: this is not a reactive framework.
  It is a broadcast channel with a memory cell.

All public observables (`hr$`, `zone$`, `step$`, `fused$`, `rmssd$`,
`trimp$`, etc.) are declared as `ReadableStream<T>` in the type system,
hiding the `emit()` method from consumers.

## Consequences

### Positive

- Zero external dependency — no bundler or polyfill surprises.
- Subscribers always see current state, matching UI expectations.
- Error in one listener cannot crash the recording pipeline.
- Implementation is 62 lines and trivially auditable.
- Consistent pattern across all stateful modules (12+ usages).

### Negative

- No built-in operators (`map`, `filter`, `debounce`). Consumers who
  want reactive composition must bring their own library or write
  callbacks.
- No completion signal — streams never "end". This is intentional
  (sessions have explicit `end()` methods), but it means there's no
  `complete` or `error` channel.
- No backpressure — a slow subscriber will accumulate calls on the
  microtask queue. This is acceptable for HR data (≤ 1 Hz on standard
  profiles) but could be an issue for high-frequency ECG streams.

## Alternatives Considered

1. **RxJS `BehaviorSubject`** — rejected: 200 kB dependency, complex
   operator import tree, overkill for broadcast-only use.

2. **Node.js `EventEmitter`** — rejected: no last-value replay, not
   available in all runtimes (Web, Workers), would need a polyfill or
   reimplementation anyway.

3. **TC39 `Observable` proposal** — rejected: not yet stage 3 at time
   of writing, no runtime support, and would still need a polyfill.

4. **Callback registration without class** — rejected: would scatter
   `Set<(v: T) => void>` + `current` + `emit` logic across every module
   that needs it.

## References

- Source: `packages/core/src/stream.ts`
- Tests: `packages/core/src/__tests__/stream.test.ts`
- Type definition: `ReadableStream<T>` in `packages/core/src/types.ts`
- Usage: `SessionRecorder.hr$`, `WorkoutEngine.step$`,
  `MultiDeviceManager.fused$`, `GroupSession.stats$`,
  `RollingRMSSD.rmssd$`, `TRIMPAccumulator.trimp$`
