---
title: "@hrkit/core"
description: "Zero-dependency TypeScript library for BLE heart rate sensor data processing"
---

# @hrkit/core

Zero-dependency TypeScript library for BLE heart rate sensor data processing

## Install

```bash
pnpm add @hrkit/core
```

## Key features

- **GATT HR parsing** — standard BLE Heart Rate (0x2A37) with contact/energy/RR support
- **HRV analytics** — RMSSD, SDNN, pNN50, plus advanced Poincaré, DFA α1, LF/HF power
- **5-zone model** — configurable zone boundaries with `hrToZone()` and `zoneDistribution()`
- **Bannister TRIMP** — sex-based exponential weighting (male 1.92 / female 1.67 / neutral 1.80)
- **Artifact filtering** — RR-interval outlier detection and removal
- **Session recording** — stateful recorder with round tracking and pause/resume
- **VO2max estimation** — Uth, session-based, and Cooper test methods
- **Stress scoring** — composite index from HRV + HR + breathing rate
- **AFib screening** — Shannon entropy + Poincaré + turning point analysis
- **Blood pressure estimation** — PTT-based with per-user calibration
- **Multi-device fusion** — fuse HR from multiple BLE devices with Kalman filtering
- **Group sessions** — multi-athlete dashboards with leaderboards and zone alerts
- **Workout protocols** — Tabata, EMOM, intervals, BJJ rounds engine
- **Training plans** — multi-week periodization with compliance tracking
- **Session replay** — playback at 1–8× speed with coach annotations
- **Plugin architecture** — lifecycle hooks for extensibility
- **Serialization** — JSON, CSV, and TCX export

## Quick example

```typescript
import { analyzeSession } from '@hrkit/core';

const session = {
  samples: [
    { timestamp: 0, hr: 72 },
    { timestamp: 1000, hr: 75 },
    { timestamp: 2000, hr: 80 },
  ],
  rrIntervals: [800, 810, 790, 820, 805],
};

const report = analyzeSession(session, { maxHR: 185, restHR: 48 });
console.log(report.rmssd);           // HRV in ms
console.log(report.trimp);           // training impulse
console.log(report.zoneDistribution); // time-in-zone breakdown
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/core#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/core`](https://github.com/josedab/hrkit/tree/main/packages/core) · v0.2.0 · [npm](https://www.npmjs.com/package/@hrkit/core)
