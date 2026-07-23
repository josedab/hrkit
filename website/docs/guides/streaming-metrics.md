---
sidebar_position: 20
title: Streaming Metrics
description: Real-time HRV and training load with RollingRMSSD and TRIMPAccumulator.
---

# Streaming Metrics

@hrkit provides two stateful accumulators — `RollingRMSSD` and `TRIMPAccumulator` — that maintain internal buffers and emit updated metrics on each `ingest()` call. Use them during live sessions to track HRV and training load in real time.

## RollingRMSSD

Computes RMSSD over a sliding window of recent RR intervals.

```typescript
import { RollingRMSSD } from '@hrkit/core';

const rolling = new RollingRMSSD(30, 5);
// windowSize = 30 → keep the last 30 RR intervals
// minSamples = 5  → suppress output until at least 5 intervals are buffered
```

### Ingesting data

Call `ingest()` each time new RR intervals arrive from the sensor:

```typescript
rolling.ingest([812, 798, 825], Date.now());
```

The accumulator appends the intervals to its internal buffer, trims to `windowSize`, and — if enough samples exist — emits the current RMSSD through the observable.

### Subscribing to updates

`rmssd$` uses the lightweight HRKit `ReadableStream<WindowedHRV>` interface and emits after every `ingest()`:

```typescript
const unsubscribe = rolling.rmssd$.subscribe(({ rmssd, sampleCount }) => {
  console.log(`RMSSD: ${rmssd.toFixed(1)} ms (n=${sampleCount})`);
});

// Later:
unsubscribe();
```

### Resetting

Clear the internal buffer and start fresh (e.g., between rounds or sessions):

```typescript
rolling.reset();
```

## TRIMPAccumulator

Tracks cumulative Bannister TRIMP as heart rate samples arrive.

```typescript
import { TRIMPAccumulator } from '@hrkit/core';

const accumulator = new TRIMPAccumulator({
  maxHR: 185,
  restHR: 48,
  sex: 'male',
});
```

### Ingesting data

Feed each HR reading with its timestamp:

```typescript
accumulator.ingest(142, Date.now());
```

### Subscribing to updates

`trimp$` uses the same subscribe/get stream interface and emits the running total after every `ingest()`:

```typescript
accumulator.trimp$.subscribe(({ trimp }) => {
  console.log(`Cumulative TRIMP: ${trimp.toFixed(1)}`);
});
```

### Resetting

```typescript
accumulator.reset(); // zero out the running total
```

## Full live-session example

Wire both accumulators into a `SessionRecorder` to get real-time HRV and load during a workout:

```typescript
import { RollingRMSSD, TRIMPAccumulator } from '@hrkit/core';

// Create accumulators
const rollingHRV = new RollingRMSSD(30, 5);
const trimpAcc = new TRIMPAccumulator({
  maxHR: 185,
  restHR: 48,
  sex: 'male',
});

// Subscribe to real-time updates
rollingHRV.rmssd$.subscribe(({ rmssd }) => {
  console.log(`Live RMSSD: ${rmssd.toFixed(1)} ms`);
});
trimpAcc.trimp$.subscribe(({ trimp }) => {
  console.log(`Session TRIMP: ${trimp.toFixed(1)}`);
});

// Feed data as it arrives from the sensor
function onHeartRateSample(hr: number, rrIntervals: number[]) {
  const now = Date.now();
  if (rrIntervals.length > 0) {
    rollingHRV.ingest(rrIntervals, now);
  }
  trimpAcc.ingest(hr, now);
}
```

:::info Buffer behavior
Both accumulators maintain internal state. `RollingRMSSD` keeps a sliding window and emits only when `minSamples` is reached. `TRIMPAccumulator` emits the running cumulative total on every `ingest()` call. Call `reset()` to clear state between sessions.
:::

## Next steps

- **[HRV Metrics](./hrv-metrics)** — Understand the RMSSD and SDNN that RollingRMSSD computes
- **[Zones & TRIMP](./zones-and-trimp)** — Learn the zone model and TRIMP formula behind TRIMPAccumulator
- **[Dashboard Widgets](./widgets)** — Display streaming metrics in real time with Web Components
