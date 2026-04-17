# Conformance Corpus

Each JSON file in this directory is a captured BLE notification trace from a real (or synthetic) device, conforming to the `ConformanceFixture` schema (`packages/core/src/conformance.ts`).

## Add a fixture

1. Capture the GATT notifications using `recordNotification(view, timestamp)` from `@hrkit/core`, or use the CLI:
   ```bash
   hrkit submit-fixture \
     --device "Polar H10" --service 180D --characteristic 2A37 \
     --capture my-recording.jsonl --out fixtures/conformance/polar-h10-mine.json
   ```
2. Validate locally:
   ```bash
   pnpm validate:corpus
   ```
3. Open a PR. CI runs the corpus on every push.

## Privacy

Fixtures must not contain personally-identifying timestamps. Strip absolute clocks (use `at_ms` relative to recording start) and any device identifiers other than brand/model.

## Sources

- `polar-h10-baseline.json` — synthetic Polar H10 trace (3 packets, RR included)
- `garmin-hrm-pro-baseline.json` — synthetic Garmin HRM-Pro trace (HR-only)
- `wahoo-tickr-baseline.json` — synthetic Wahoo TICKR trace
