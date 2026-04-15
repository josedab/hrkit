# @hrkit/bjj-example

Reference implementation for the @hrkit SDK — a BJJ (Brazilian Jiu-Jitsu) rolling intensity tracker.

## What it demonstrates

- **Device connection**: Prefer Polar H10, fallback to any BLE HR device
- **Pre-session readiness**: HRV baseline + readiness verdict
- **Multi-round recording**: Start/end rounds during a sparring session
- **ECG capability gating**: Only activate ECG features on Polar devices
- **Post-session metrics**: HRV, TRIMP, zone distribution, per-round breakdown

## Running

```bash
pnpm start
```

Uses `MockTransport` with simulated data — no hardware needed.
