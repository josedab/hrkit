# @hrkit/core

Zero-dependency TypeScript library for BLE heart rate sensor data processing.

## Features

- **GATT HR Parser** — Parse BLE Heart Rate Measurement characteristic (0x2A37)
- **HRV Metrics** — RMSSD, SDNN, pNN50, mean HR, baseline tracking, readiness verdict
- **Zone Calculator** — 5-zone HR mapping with time-in-zone distribution
- **TRIMP** — Bannister training impulse with sex-based weighting
- **Artifact Filter** — RR interval artifact detection and interpolation
- **Session Recorder** — Stateful session recording with round tracking and observable streams
- **Device Profiles** — Capability-based device abstraction
- **MockTransport** — In-memory BLE transport for testing

## Usage

```typescript
import { rmssd, sdnn, hrToZone, SessionRecorder } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

// Pure metric functions
const hrvValue = rmssd([800, 810, 790, 820, 805]);
const zone = hrToZone(162, { maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] });

// Session recording
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });
recorder.hr$.subscribe((hr) => console.log('HR:', hr));
```
