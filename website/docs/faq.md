---
sidebar_position: 100
title: FAQ & Troubleshooting
description: Common questions and solutions when using @hrkit.
---

# FAQ & Troubleshooting

## General

### Does @hrkit work with my heart rate sensor?

If your sensor implements the standard Bluetooth Heart Rate Profile (service `0x180D`), yes. This includes virtually all BLE chest straps and most optical sensors from Polar, Garmin, Wahoo, Magene, CooSpo, Scosche, and generic brands.

See [Device Compatibility](./reference/device-compatibility) for a full list.

### Do I need a Polar device?

No. `@hrkit/core` works with any BLE HR device. The `@hrkit/polar` package is optional and only needed if you want raw ECG streaming or accelerometer data from Polar devices.

### Can I test without BLE hardware?

Yes. `MockTransport` lets you replay in-memory data. See the [Quick Start](./getting-started/quick-start) guide.

```typescript
import { MockTransport } from '@hrkit/core';

const transport = new MockTransport({
  device: { id: 'test', name: 'Mock' },
  packets: [
    { timestamp: 0, hr: 72, rrIntervals: [833], contactDetected: true },
  ],
});
```

### What's the difference between RMSSD and SDNN?

- **RMSSD** measures beat-to-beat variability (parasympathetic nervous system). Best for daily readiness tracking. Use short recordings (1–5 min).
- **SDNN** measures overall variability (both sympathetic and parasympathetic). More sensitive to recording duration. The clinical standard is a 5-minute recording.

For daily readiness checks, use RMSSD.

## BLE / Connection Issues

### Web Bluetooth: "Must be called from a user gesture"

Web Bluetooth requires that `scan()` / `connectToDevice()` is called from a user-initiated event handler (click, tap). You can't auto-connect on page load.

```typescript
// ❌ Won't work
connectToDevice(transport, { prefer: [GENERIC_HR] });

// ✅ Works
button.addEventListener('click', () => {
  connectToDevice(transport, { prefer: [GENERIC_HR] });
});
```

### Web Bluetooth: "SecurityError" or nothing happens

Web Bluetooth only works on secure origins:
- `https://` URLs
- `localhost` (for development)

HTTP won't work.

### React Native: No devices found

1. Check that Bluetooth is turned on
2. Verify you've requested runtime permissions (Android 12+)
3. Make sure the sensor is in pairing mode or advertising
4. Try increasing `timeoutMs`

### Device connects but no HR data

- Ensure the sensor has skin contact (chest straps need moisture)
- Some devices need a few seconds to stabilize after connection
- Check `contactDetected` in the `HRPacket` — if `false`, the sensor doesn't have a good reading

## Metrics

### Why are my RR intervals different from other apps?

@hrkit converts raw BLE values using `raw × 1000/1024`. Some apps incorrectly use `raw × 1` (treating raw values as milliseconds). The BLE spec defines RR values in 1/1024 second units.

### My RMSSD seems too high/low

1. **Filter artifacts first** — A single artifact can dramatically skew RMSSD
2. **Check recording conditions** — Morning rest readings are most consistent
3. **Use a chest strap** — Optical sensors are less accurate for RR intervals
4. **Compare trends, not absolutes** — Normal RMSSD ranges vary widely between individuals (20–120ms is typical)

### TRIMP values seem wrong

- Make sure `restHR` is set correctly — it's used as the baseline in the Bannister formula
- Verify `maxHR` is accurate — age-based estimates (220 - age) are often inaccurate
- Check that `sex` is set if you want gendered weighting (otherwise use `'neutral'`)

## TypeScript / Build

### "Cannot find module '@hrkit/core/profiles'"

Make sure you're using a bundler or runtime that supports the `exports` field in `package.json`. The `profiles` sub-export uses Node.js subpath exports.

If your toolchain doesn't support it, import directly:

```typescript
import { GENERIC_HR } from '@hrkit/core';
```

### ESM-only errors

All @hrkit packages ship as ES modules. If you're using CommonJS (`require()`), you'll need to:
- Switch to ESM (`import`) — recommended
- Or use dynamic `import()` in CommonJS
- Or configure your bundler to handle ESM imports
