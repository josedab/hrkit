---
sidebar_position: 9
title: Workout Protocols
description: Define and execute structured workouts with the WorkoutEngine.
---

# Workout Protocols

The `WorkoutEngine` executes structured workouts with automatic step progression and HR target compliance. Define a protocol (steps with durations and targets), start the engine, and feed it HR packets — it handles the rest.

## Quick Start

```typescript
import { WorkoutEngine, tabataProtocol } from '@hrkit/core';

const zoneConfig = { maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number] };
const engine = new WorkoutEngine(tabataProtocol(), zoneConfig);

// React to step changes
engine.step$.subscribe(({ step, stepIndex }) => {
  console.log(`Step ${stepIndex}: ${step.name} (${step.durationSec}s)`);
});

// React to target compliance
engine.target$.subscribe(({ onTarget, hr, target }) => {
  console.log(onTarget ? '✅ On target' : `⚠️ Off target (HR: ${hr}, target zone: ${target.zone})`);
});

// Start and feed packets
engine.start(Date.now());
for await (const packet of conn.heartRate()) {
  engine.ingest(packet);
}
```

## Built-in Protocols

| Factory | Description |
|---------|-------------|
| `tabataProtocol()` | 20s work / 10s rest × 8, with warmup and cooldown |
| `emomProtocol(minutes, workSec)` | Every-minute-on-the-minute |
| `pyramidProtocol(steps, restSec)` | Ascending/descending work durations |
| `bjjRoundsProtocol(rounds, workSec, restSec)` | BJJ sparring rounds |
| `intervalProtocol(rounds, workSec, restSec)` | Simple work/rest intervals |

## Custom Protocols

```typescript
import { WorkoutEngine } from '@hrkit/core';
import type { WorkoutProtocol } from '@hrkit/core';

const myProtocol: WorkoutProtocol = {
  name: 'Sprint Intervals',
  description: '30s sprint / 90s recovery × 6',
  steps: [
    { name: 'Warmup', type: 'warmup', durationSec: 300 },
    { name: 'Sprint', type: 'work', durationSec: 30, target: { zone: 5 }, repeat: 6 },
    { name: 'Recovery', type: 'rest', durationSec: 90, target: { zone: 2 }, repeat: 6 },
    { name: 'Cooldown', type: 'cooldown', durationSec: 300 },
  ],
};

const engine = new WorkoutEngine(myProtocol, zoneConfig);
```

Steps with `repeat > 1` are automatically expanded into individual entries.

## Step Targets

Each step can have an optional target:

```typescript
interface StepTarget {
  zone?: 1 | 2 | 3 | 4 | 5;        // target HR zone
  hrRange?: [number, number];        // target HR range in BPM
}
```

The engine checks compliance on each HR packet and emits `target$` events.

## Engine API

| Method / Property | Description |
|-------------------|-------------|
| `start(timestamp)` | Start the workout |
| `ingest(packet)` | Feed an HR packet — advances steps and checks targets |
| `pause()` | Pause the workout |
| `resume(timestamp)` | Resume — adjusts timing to exclude paused duration |
| `currentStep()` | Get the current step, or `undefined` if idle/completed |
| `stepElapsedSec()` | Seconds elapsed in the current step |
| `stepRemainingSec()` | Seconds remaining in the current step |
| `totalElapsedSec()` | Total workout elapsed time |
| `totalDurationSec()` | Planned total duration |
| `getState()` | `'idle'` \| `'running'` \| `'paused'` \| `'completed'` |
| `step$` | Observable: emits on step change |
| `target$` | Observable: emits target compliance per packet |
| `state$` | Observable: emits workout state changes |
