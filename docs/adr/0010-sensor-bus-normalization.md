# ADR 0010: Sensor Bus for Multi-Modality Normalization

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** @hrkit maintainers

## Context

As the SDK expanded beyond heart rate to support cycling power, cadence,
running speed, SpO₂, smart trainers, and CGMs, each sensor type had its
own data pathway. A session recorder handling only `HRPacket` cannot
correlate power with HR, or fuse glucose readings with training load.

Consumers building multi-sensor dashboards needed to subscribe to N
separate streams and manually correlate timestamps. This is fragile and
does not scale to new sensor types.

## Decision

We introduce a `SensorBus` in `packages/core/src/sensor-bus.ts` — a
typed, in-memory pub/sub that normalizes all sensor readings into a
single discriminated union:

```ts
type SensorEvent =
  | { kind: 'hr';          timestamp; source; bpm; rrIntervals? }
  | { kind: 'power';       timestamp; source; watts; cadenceRpm? }
  | { kind: 'speed';       timestamp; source; kph }
  | { kind: 'cadence';     timestamp; source; rpm }
  | { kind: 'glucose';     timestamp; source; mgdl; trend? }
  | { kind: 'trainer';     timestamp; source; resistanceWatts?; gradePercent? }
  | { kind: 'spo2';        timestamp; source; percent }
  | { kind: 'temperature'; timestamp; source; celsius }
  | { kind: 'weight';      timestamp; source; kg; bodyFatPct? };
```

Key design choices:

- **Discriminated union on `kind`**: TypeScript narrows the payload
  automatically when consumers check `event.kind`.
- **`source` tag on every event**: enables multi-device attribution
  (e.g., HR from chest strap, power from trainer).
- **Unidirectional, synchronous**: handlers must be cheap. Expensive
  processing should be enqueued.
- **No last-value replay**: unlike `SimpleStream`, the bus emits
  point-in-time facts. New subscribers do not receive stale readings.
- **Type-safe filtering**: `bus.on('hr', handler)` narrows the handler
  parameter to `SensorEventOf<'hr'>`.

## Consequences

### Positive

- Single subscription point for all sensor modalities — dashboards
  subscribe once, switch on `kind`.
- Adding a new sensor type is a one-line union member addition
  (no new classes, interfaces, or streams).
- `source` tag enables natural multi-device correlation without
  separate multiplexing logic.
- Type-safe narrowing eliminates runtime checks for sensor-specific
  fields.

### Negative

- All events share one channel — high-frequency sensors (ECG at 130 Hz)
  can flood the bus and slow low-frequency consumers.
- No built-in buffering or backpressure. Consumers must be fast or
  decouple with a queue.
- The union grows with each new sensor type, increasing the size of
  the type in IDE tooltips and autocomplete.

## Alternatives Considered

1. **Per-modality streams** (`hr$`, `power$`, `cadence$`, etc.) —
   rejected: explosion of observable properties, does not compose for
   multi-sensor views, and adding a new sensor type requires adding a
   new stream everywhere.

2. **Generic `EventEmitter` with string keys** — rejected: loses
   TypeScript narrowing. Consumers would need to cast payloads.

3. **RxJS-style `merge()` of typed observables** — rejected: would
   require RxJS dependency (zero-dep constraint) or reimplementing
   merge semantics.

## References

- Source: `packages/core/src/sensor-bus.ts`
- Types: `SensorEvent`, `SensorEventKind`, `SensorEventOf<K>`
- Sensor parsers: `packages/core/src/sensors.ts`
  (cycling power, CSC, RSC, SpO₂)
- Fusion consumer: `packages/core/src/sensor-fusion.ts`
  (subscribes to bus for multi-source HR)
