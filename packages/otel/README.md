# @hrkit/otel

Backend-agnostic, OpenTelemetry-shaped instrumentation hooks for [@hrkit](https://github.com/josedab/hrkit) transports and sessions. Zero runtime dependencies — bring your own OTel / Datadog / Honeycomb / console adapter.

## Install

```bash
npm install @hrkit/otel
```

> No peer dependency on `@opentelemetry/api`. The package defines its own minimal `InstrumentationHooks` interface so you can wire in any backend with a tiny adapter.

## Usage

```ts
import { wrapTransport, NOOP_HOOKS, type InstrumentationHooks } from '@hrkit/otel';

const hooks: InstrumentationHooks = {
  onSpanStart: (name, attrs) => {
    const span = tracer.startSpan(name, { attributes: attrs });
    return { spanId: span.spanContext().spanId, startedAt: Date.now() };
  },
  onSpanEnd: (ctx, status, error) => {
    const span = lookupSpan(ctx.spanId);
    if (status === 'error' && error) span.recordException(error);
    span.setStatus({ code: status === 'ok' ? 1 : 2 });
    span.end();
  },
  onMetric: (name, kind, value, attrs) => {
    if (kind === 'gauge') gauge(name).record(value, attrs);
    if (kind === 'counter') counter(name).add(value, attrs);
    if (kind === 'histogram') histogram(name).record(value, attrs);
  },
};

const transport = wrapTransport(rawTransport, hooks);
// scan / connect / disconnect emit spans.
// HR notifications emit `hrkit.hr.bpm` (gauge) and `hrkit.rr.ms` (histogram).
```

Pass `NOOP_HOOKS` (the default) to disable instrumentation without changing call sites.

## API

| Symbol | Description |
|--------|-------------|
| `wrapTransport(transport, hooks?)` | Returns an API-compatible `BLETransport` that emits spans + metrics. Defaults to `NOOP_HOOKS` so it's safe to wrap unconditionally. |
| `recordHrSample(hooks, hr, attrs?)` | Convenience helper to emit a single `hrkit.hr.bpm` gauge from your own code path. |
| `NOOP_HOOKS` | A pass-through implementation that drops all events. |
| `MemoryHooks` | In-memory implementation that records every span and metric on its `spans` / `metrics` arrays. Useful for tests, offline analysis, and replaying captures. |
| `InstrumentationHooks` | The interface your adapter implements. Three callbacks: `onSpanStart`, `onSpanEnd`, `onMetric`. |
| `MetricKind` | `'counter' \| 'gauge' \| 'histogram'`. |
| `SpanContext` | Opaque handle returned by `onSpanStart` and passed back to `onSpanEnd`. |

## Emitted signals

| Name | Kind | Attributes | When |
|------|------|------------|------|
| `hrkit.ble.scan` | span | `profiles` | Around `transport.scan()` |
| `hrkit.ble.scan.devices` | counter | — | Number of devices yielded by a scan |
| `hrkit.ble.connect` | span | `deviceId`, `profile` | Around `transport.connect()` |
| `hrkit.ble.disconnect` | span | `deviceId`, `deviceName` | Around `connection.disconnect()` |
| `hrkit.hr.bpm` | gauge | `deviceId`, `deviceName` | Per HR notification |
| `hrkit.rr.ms` | histogram | `deviceId`, `deviceName` | Per RR interval, when present |

## Testing with `MemoryHooks`

```ts
import { wrapTransport, MemoryHooks } from '@hrkit/otel';

const hooks = new MemoryHooks();
const t = wrapTransport(mockTransport, hooks);
// ...exercise SDK...
expect(hooks.spans.find((s) => s.name === 'hrkit.ble.connect')?.status).toBe('ok');
expect(hooks.metrics.filter((m) => m.name === 'hrkit.hr.bpm')).toHaveLength(60);
```

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/otel/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
