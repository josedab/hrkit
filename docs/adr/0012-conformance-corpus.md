# ADR 0012: Conformance Corpus for Device Verification

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** @hrkit maintainers

## Context

BLE heart rate devices from different manufacturers encode the GATT
Heart Rate Measurement characteristic (0x2A37) with varying flag
combinations: 8-bit vs 16-bit HR, optional contact detection, optional
energy expended, optional RR intervals. A parser that works for Polar
may silently mis-parse a Wahoo or Garmin if their flag patterns differ.

Manual testing requires physical devices, which are expensive and cannot
run in CI. Regression testing against "known good" output from real
devices is essential to prevent parser drift.

## Decision

We maintain a **conformance corpus** in `fixtures/conformance/` — a
directory of JSON fixture files, each containing a frozen BLE
notification trace from a real (or verified synthetic) device.

Each fixture conforms to the `ConformanceFixture` schema
(`packages/core/src/conformance.ts`) and includes:

- Device metadata (brand, model, firmware version)
- GATT service and characteristic UUIDs
- An array of raw BLE notification payloads (hex-encoded `DataView` bytes)
- The expected parsed output for each notification

CI runs `verifyFixture()` on every fixture on every PR:

```ts
for (const notification of fixture.notifications) {
  const actual = parseHeartRate(hexToDataView(notification.hex));
  expect(actual).toDeepEqual(notification.expected);
}
```

Current corpus:
- `polar-h10-baseline.json` — Polar H10 (HR + RR intervals)
- `garmin-hrm-pro-baseline.json` — Garmin HRM-Pro (HR only)
- `wahoo-tickr-baseline.json` — Wahoo TICKR (HR + RR)

### Adding a device

1. Capture notifications using `recordNotification(view, timestamp)`
   or the CLI: `hrkit submit-fixture --device "Brand Model" ...`
2. Run `pnpm validate:corpus` locally.
3. Open a PR — CI replays the capture and fails on any drift.

### Privacy

Fixtures strip absolute timestamps (use `at_ms` relative to recording
start) and device identifiers beyond brand/model. No PII is stored.

## Consequences

### Positive

- Parser changes are validated against real device output on every PR.
- No physical hardware needed in CI — fixtures are deterministic.
- New devices can be added by the community via PR (with the
  `device-fixture` issue template).
- The certified devices page is auto-generated from the corpus,
  so documentation never drifts from tested reality.
- Privacy-safe: no PII in fixtures, no absolute timestamps.

### Negative

- Fixtures are point-in-time snapshots — they don't cover firmware
  updates that change encoding behavior.
- Synthetic fixtures (current corpus) don't capture real-world noise
  (truncated packets, BLE retry artifacts). Real device captures
  from the community will improve this over time.
- The schema must be versioned if the parser output shape changes
  (tied to `SESSION_SCHEMA_VERSION`).

## Alternatives Considered

1. **Mock-only testing** (no real device data) — rejected: mocks
   encode the author's assumptions about the protocol. Real device
   captures are ground truth.

2. **Live device CI** (BLE dongles in CI runners) — rejected:
   requires hardware, flaky Bluetooth on CI runners, and expensive.

3. **Community-maintained compatibility list** (no automated testing) —
   rejected: lists go stale. Automated corpus verification ensures
   the list reflects reality.

## References

- Corpus: `fixtures/conformance/`
- Schema: `packages/core/src/conformance.ts`
- CI validation: `.github/workflows/corpus-badges.yml`
- Docs: `website/docs/reference/certified-devices.md`
- Issue template: `.github/ISSUE_TEMPLATE/device-fixture.yml`
