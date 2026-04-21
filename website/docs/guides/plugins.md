# Plugin Architecture

`@hrkit/core` exposes a small lifecycle-hook plugin system that lets
apps extend recording without forking the SDK or adding dependencies
to core.

This page is the user-facing companion to
[ADR 0001](https://github.com/josedab/hrkit/blob/main/docs/adr/0001-plugin-architecture.md).
Read the ADR for the full rationale and trade-offs.

## When to use a plugin

Use a plugin when your extension touches the **recording lifecycle**:

- Reacting to every incoming HR packet (event tagging, smoothing, custom artifact policy).
- Reacting to round/session boundaries (logging, persistence, live dashboards).
- Adding **custom metrics** to the analyze step.

For pure post-processing of an already-recorded session, prefer a
standalone function operating on the `Session` object — no plugin needed.

## Writing a plugin

A plugin is any object implementing `HRKitPlugin`:

```ts
import type { HRKitPlugin, HRPacket, Session } from '@hrkit/core';

const smoothing: HRKitPlugin = {
  name: 'hr-smoothing',
  version: '1.0.0',

  onPacket(packet: HRPacket): HRPacket | undefined {
    // Return a transformed packet, or undefined to leave it unchanged.
    return { ...packet, hr: Math.round(packet.hr) };
  },

  onAnalyze(session: Session) {
    // Returned object is merged into the analyze() result.
    return { customSmoothedMetric: session.packets.length };
  },
};
```

All hooks are optional. The full list:

| Hook | When it fires | Return value |
| ---- | ------------- | ------------ |
| `onInit()` | When the plugin is registered. | — |
| `onPacket(packet)` | For each incoming HR packet. | Optional transformed packet. |
| `onRoundStart(i, meta)` | When a round starts. | — |
| `onRoundEnd(round)` | When a round ends. | — |
| `onSessionEnd(session)` | When a session ends. | — |
| `onAnalyze(session)` | During `analyzeSession`. | Custom metrics object (merged). |
| `onDestroy()` | When the plugin is unregistered. | — |

## Registering plugins

```ts
import { PluginRegistry, SessionRecorder } from '@hrkit/core';

const plugins = new PluginRegistry();
plugins.register(smoothing);

const recorder = new SessionRecorder({ plugins });
```

`register()` throws if a plugin with the same `name` is already
registered.

## Stability guarantees

- The `HRKitPlugin` interface and `PluginRegistry`'s public methods
  follow semver — breaking changes will require a major version bump.
- Hooks fire in **registration order**.
- A plugin that throws is **silently skipped** so it cannot kill an
  athlete's recording. Add your own logging during development.

## Limitations

- Hooks are **synchronous**. If you need async work, enqueue it
  yourself (e.g. `void someAsyncFn()`); don't `await` inside a hook.
- There is no per-hook configuration — a plugin is registered as a
  whole.
- Mutation chains depend on registration order. If you register
  smoothing then artifact-tagging, the tagger sees smoothed values.

See [ADR 0001](https://github.com/josedab/hrkit/blob/main/docs/adr/0001-plugin-architecture.md)
for the alternatives considered (event emitters, subclassing,
async hooks, external buses) and why we rejected them.

## Next steps

- **[Building a Custom Transport](./custom-transport)** — Implement BLETransport for any platform
- **[API Reference](../reference/core-api)** — Full API documentation for all core functions
