---
title: Certified Devices
description: Auto-generated list of BLE devices verified against the @hrkit conformance corpus.
---

# Certified Devices

> **Auto-generated.** Edit `fixtures/conformance/` and re-run `node scripts/generate-certified-devices.mjs` — never edit this file by hand.

Every device below ships a frozen sample capture inside `fixtures/conformance/`.
The CI pipeline replays each capture against the @hrkit GATT parser on every PR and
fails the build on any drift, so this list reflects the **current verified state of
`main`**, not a manual claim.

| Brand | Model | Firmware | Service / Characteristic | Conformance |
|-------|-------|----------|--------------------------|-------------|
| Garmin | HRM-Pro | 5.50 | `180d` / `2a37` | ![garmin-hrm-pro-baseline](/badges/garmin-hrm-pro-baseline.svg) |
| Polar | H10 | 3.1.1 | `180d` / `2a37` | ![polar-h10-baseline](/badges/polar-h10-baseline.svg) |
| Wahoo | TICKR | 2.4 | `180d` / `2a37` | ![wahoo-tickr-baseline](/badges/wahoo-tickr-baseline.svg) |

## How a device gets on this list

1. Capture a representative ~10 s notification stream from the real device.
2. Add a fixture JSON to `fixtures/conformance/` with the brand, model,
   firmware, GATT identifiers, and the expected parsed output.
3. Open a PR — the CI `validate-corpus` job replays the capture against
   `@hrkit/core`'s parser and refuses to merge on any mismatch.

## Adding your own device

See [Contributing → Conformance Corpus](../guides/contributing.md) for the full
procedure including how to capture notifications safely (no PII), declare a
fixture schema version, and request a badge.
