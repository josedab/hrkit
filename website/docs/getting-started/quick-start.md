---
sidebar_position: 1
title: Quick Start
description: Get a working heart rate session in under 5 minutes — no BLE hardware required.
---

# Quick Start

Get a working heart rate session running in under 5 minutes. No BLE hardware required.

## Install

```bash
npm install @hrkit/core
```

`@hrkit/core` has **zero runtime dependencies**. It works in any JavaScript runtime.

## Your first session

Create a file called `demo.ts` and paste this:

```typescript
import { SessionRecorder, connectToDevice, MockTransport, GENERIC_HR } from '@hrkit/core';

// MockTransport replays in-memory data — no real BLE device needed
const transport = new MockTransport({
  device: { id: 'demo', name: 'Mock HR Strap' },
  packets: [
    { timestamp: 0,    hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 1000, hr: 78, rrIntervals: [769], contactDetected: true },
    { timestamp: 2000, hr: 85, rrIntervals: [706], contactDetected: true },
    { timestamp: 3000, hr: 92, rrIntervals: [652], contactDetected: true },
    { timestamp: 4000, hr: 88, rrIntervals: [682], contactDetected: true },
  ],
});

// Connect — same API you'll use with real BLE
const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });

// Record session
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();

console.log(`Samples: ${session.samples.length}`);
console.log(`RR intervals: ${session.rrIntervals.length}`);
console.log(`Duration: ${session.samples.at(-1)!.timestamp / 1000}s`);
```

Run it:

```bash
npx tsx demo.ts
```

You'll see:

```
Samples: 5
RR intervals: 5
Duration: 4s
```

## Add metrics

All metric functions are pure — pass data in, get results out:

```typescript
import { rmssd, sdnn, hrToZone, trimp } from '@hrkit/core';

// HRV from RR intervals
const rr = session.rrIntervals;
console.log(`RMSSD: ${rmssd(rr).toFixed(1)} ms`);
console.log(`SDNN: ${sdnn(rr).toFixed(1)} ms`);

// HR zones
const zoneConfig = {
  maxHR: 185,
  zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number],
};
console.log(`Zone at 162 bpm: ${hrToZone(162, zoneConfig)}`); // → 4

// Training impulse (TRIMP)
const load = trimp(session.samples, { maxHR: 185, restHR: 48, sex: 'male' });
console.log(`TRIMP: ${load.toFixed(1)}`);
```

## Next steps

- **[Installation guide](./installation)** — Add a platform adapter for React Native or Web Bluetooth
- **[Architecture](../core-concepts/architecture)** — Understand how the SDK is structured
- **[HRV Metrics](../guides/hrv-metrics)** — Learn what the numbers mean
