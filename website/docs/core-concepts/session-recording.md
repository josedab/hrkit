---
sidebar_position: 3
title: Session Recording
description: Record heart rate sessions with rounds, real-time streams, and full analytics.
---

# Session Recording

`SessionRecorder` is the main stateful abstraction in @hrkit. It ingests heart rate packets, tracks zones in real time, supports round-based intervals, and produces a `Session` with full analytics data.

## Basic usage

```typescript
import { SessionRecorder, connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
```

## Configuration

```typescript
const recorder = new SessionRecorder({
  maxHR: 185,                                    // required
  restHR: 48,                                    // optional, needed for TRIMP
  zones: [0.6, 0.7, 0.8, 0.9],                  // optional, defaults shown
  sex: 'male',                                   // optional, for TRIMP weighting
});
```

The `zones` array defines 4 thresholds as percentages of `maxHR`, creating 5 zones:
- Zone 1: below 60%
- Zone 2: 60–70%
- Zone 3: 70–80%
- Zone 4: 80–90%
- Zone 5: above 90%

## Real-time observables

`SessionRecorder` exposes two observable streams with BehaviorSubject-like semantics — they emit the current value immediately on subscribe:

```typescript
recorder.hr$.subscribe((hr) => {
  console.log('Current HR:', hr);
  // Update your UI
});

recorder.zone$.subscribe((zone) => {
  console.log('Current zone:', zone);
  // Update zone indicator
});
```

You can also query the current state at any time:

```typescript
recorder.currentHR();        // latest HR value, or null
recorder.currentZone();      // latest zone (1–5), or null
recorder.elapsedSeconds();   // seconds since first packet
```

## Round tracking

For interval training (BJJ rounds, HIIT intervals, etc.), use the round API:

```typescript
recorder.startRound({ label: 'Round 1' });

// ... ingest packets during the round ...

const round = recorder.endRound();
// round.samples — HR samples for this round
// round.meta — { label: 'Round 1' }
```

Rounds are included in the final session:

```typescript
const session = recorder.end();
session.rounds; // Array of Round objects
```

## Session output

`recorder.end()` returns a `Session` object:

```typescript
interface Session {
  samples: TimestampedHR[];     // all HR samples with timestamps
  rrIntervals: number[];        // all RR intervals in milliseconds
  rounds: Round[];              // recorded rounds with their samples
  config: SessionConfig;        // the config used to create the recorder
}
```

Pass session data to any metric function:

```typescript
import { rmssd, zoneDistribution, trimp } from '@hrkit/core';

const hrv = rmssd(session.rrIntervals);
const zones = zoneDistribution(session.samples, session.config);
const load = trimp(session.samples, session.config);
```
