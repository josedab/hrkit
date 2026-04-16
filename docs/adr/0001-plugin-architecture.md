# ADR 0001: Plugin Architecture

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

`@hrkit/core` is a small, dependency-free library focused on standard BLE
heart rate workflows: scanning, recording, computing HRV, zones, TRIMP,
and session aggregates. There is real demand to extend recording in
application-specific ways:

- Domain-specific metrics (e.g. BJJ rolling intensity, cycling power
  proxies, swim stroke detection).
- Cross-cutting concerns (logging, persistence, dashboards, third-party
  exports).
- Pre-processing of incoming HR packets (smoothing, event tagging,
  artifact policies beyond the built-in filter).

We want these extensions to be possible **without forking** core, without
core taking on new dependencies, and without coupling core to any
specific transport, framework, or app.

## Decision

We expose a small **lifecycle-hook plugin system** in
[`packages/core/src/plugin.ts`](https://github.com/josedab/hrkit/blob/main/packages/core/src/plugin.ts).

A plugin is any object implementing the `HRKitPlugin` interface:

```ts
interface HRKitPlugin {
  readonly name: string;
  readonly version: string;
  onInit?(): void;
  onPacket?(packet: HRPacket): HRPacket | undefined;
  onRoundStart?(roundIndex: number, meta?: RoundMeta): void;
  onRoundEnd?(round: Round): void;
  onSessionEnd?(session: Session): void;
  onAnalyze?(session: Session): Record<string, unknown>;
  onDestroy?(): void;
}
```

The `PluginRegistry` class:

- Manages registration by unique `name`.
- Invokes hooks in **registration order**.
- **Isolates failures**: a plugin that throws is silently skipped so it
  cannot crash the recording pipeline.
- Exposes a `processPacket()` method that lets a plugin **transform**
  incoming packets (returning `undefined` means "don't change it").
- Exposes a `collectAnalytics()` method that **merges** custom metrics
  from all plugins into the analyze step.

`SessionRecorder` accepts a `PluginRegistry` and invokes all hooks at
the appropriate points during recording.

### Stability guarantees

The following are **public, semver-stable**:

- The `HRKitPlugin` interface and its hook signatures.
- `PluginRegistry`'s public methods: `register`, `unregister`, `get`,
  `getAll`, `has`, `clear`.
- The order in which hooks fire (registration order, packet → round →
  session).
- The fact that plugin throws are isolated and silently skipped.

The following are **internal**:

- `PluginRegistry`'s private storage representation.
- The exact error semantics if `onInit` throws (currently propagates).

## Consequences

### Positive

- Apps can ship custom metrics (e.g. the reference `apps/bjj` app)
  without core taking a dependency on them.
- Core remains zero-dependency and small (~17 kB).
- Plugins compose: multiple plugins can transform packets in a chain.
- Failure isolation means a third-party plugin bug cannot kill an
  athlete's recording session.

### Negative / trade-offs

- **Silent skip** of plugin errors makes plugins hard to debug. Plugin
  authors should add their own logging in development.
- **Mutation order matters**: a plugin that smooths HR sees the output
  of any plugin registered before it. We document this and rely on
  `getAll()` for inspection, but there is no built-in ordering control
  beyond registration order.
- **No async hooks**. Hooks are synchronous so the recording hot path
  stays predictable. Plugins that need async work must enqueue it
  themselves (e.g. fire-and-forget `Promise.resolve().then(...)`).
- **No per-hook configuration**. A plugin is "all or nothing" — there
  is no way for `SessionRecorder` to opt out of one hook from one
  plugin.

## Alternatives considered

1. **Event emitter (`on('packet', cb)`)**. Rejected because we need
   `onPacket` to *return* a transformed packet (mutating chain), which
   is awkward with vanilla emitters. Also, named methods give better
   IntelliSense for plugin authors.

2. **Async hooks with `await`**. Rejected to keep the recording loop
   non-blocking. BLE packets arrive at up to 1 Hz on standard HR
   profiles and faster on PMD streams; a slow plugin could fall behind.

3. **Subclass `SessionRecorder`**. Rejected because it doesn't compose
   (you can only have one parent class) and it leaks core internals.

4. **External event bus (RxJS, mitt)**. Rejected because it would
   either add a dependency to core or push the integration concern out
   to every app.

## Adoption guidance

- Use a plugin when the extension touches the **recording lifecycle**
  (per-packet, per-round, per-session). For pure post-processing,
  prefer a standalone function operating on the recorded `Session`.
- Use the `name` field to detect conflicts; `register()` throws if a
  plugin with that name is already registered.
- Plugins that need to track per-session state should use a `WeakMap`
  keyed by the round/session object, or an instance field cleared in
  `onSessionEnd`.

## References

- Source: `packages/core/src/plugin.ts`
- Tests: `packages/core/src/__tests__/plugin.test.ts`
- Reference plugin: `apps/bjj/src/index.ts` (rolling intensity)
