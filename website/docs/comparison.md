---
title: Why @hrkit
description: How @hrkit compares to other heart rate SDKs and APIs.
---

# Why @hrkit?

## The problem

Building a fitness or health app that uses BLE heart rate data means solving the same problems every time:

- **Platform fragmentation** — Web Bluetooth, React Native BLE, Capacitor, Node.js each have different APIs
- **Vendor lock-in** — Polar SDK only works with Polar devices, Garmin SDK only with Garmin
- **No built-in analytics** — raw HR data is just numbers; you need HRV, zones, TRIMP, and session management
- **Cloud dependency** — aggregator APIs (Terra, Sahha) require internet and a subscription

@hrkit solves all of these with a single, open-source TypeScript SDK.

## Feature comparison

|  | @hrkit | Terra API | Sahha | Polar SDK | Apple HealthKit |
|--|--------|-----------|-------|-----------|-----------------|
| **Open source (MIT)** | ✅ | ❌ | ❌ | Partial | ❌ |
| **Works offline** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Any BLE HR device** | ✅ | Via cloud | Via cloud | Polar only | Apple Watch only |
| **Raw RR / ECG / IBI** | ✅ | Limited | ❌ | ✅ | Limited |
| **HRV metrics (RMSSD, SDNN, pNN50)** | ✅ | ❌ | Partial | ❌ | Basic |
| **Advanced HRV (Poincaré, DFA, LF/HF)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **HR zones & TRIMP** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Session recording** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Workout protocols** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **VO₂max estimation** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Stress & readiness** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Multi-device fusion** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Zero dependencies** | ✅ | N/A | N/A | ❌ | N/A |
| **TypeScript-first** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **React Native** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Web Browser** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Capacitor** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Edge / Workers** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Pricing** | Free (MIT) | Per-user/month | Per-user/month | Free | Free (Apple only) |

## When to use @hrkit

**Choose @hrkit when you want:**

- Full control over raw BLE data without a cloud middleman
- Cross-platform support (Web, React Native, Capacitor) from a single codebase
- Built-in analytics (HRV, zones, TRIMP, VO₂max) without implementing formulas yourself
- A vendor-neutral SDK that works with any BLE HR device
- Zero runtime dependencies and predictable bundle sizes (core ≤ 35kB)

**Choose something else when you need:**

- A managed cloud service with a dashboard (→ Terra, Sahha)
- Wrist-based activity tracking, not chest-strap HR (→ HealthKit, Health Connect)
- Polar-specific features beyond ECG/ACC (→ Polar SDK for training load, sleep tracking)

## Architecture advantage

Most alternatives either lock you to a vendor or require cloud connectivity:

```
Traditional approach:
  BLE Device → Vendor SDK → Vendor Cloud → Your App → Your Backend

@hrkit approach:
  BLE Device → @hrkit/core (on-device) → Your App
                    ↓
              Pure metrics, zero network required
```

@hrkit runs entirely on-device. Your users' heart rate data never leaves their phone unless you choose to send it.

## Get started

```bash
npm install @hrkit/core
```

→ [Quick Start guide](/docs/getting-started/quick-start)
