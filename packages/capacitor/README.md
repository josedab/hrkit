# @hrkit/capacitor

Capacitor BLE adapter for @hrkit (iOS + Android via `@capacitor-community/bluetooth-le`).

Part of the [@hrkit](https://github.com/josedab/hrkit) monorepo — a platform-agnostic TypeScript SDK for BLE heart-rate sensors.

## Install

```bash
npm install @hrkit/capacitor @capacitor-community/bluetooth-le
npx cap sync
```

Add the required iOS/Android Bluetooth permissions per the [bluetooth-le plugin docs](https://github.com/capacitor-community/bluetooth-le).

## Usage

```ts
import { CapacitorBLETransport } from '@hrkit/capacitor';
import { GENERIC_HR } from '@hrkit/core';

const transport = new CapacitorBLETransport({
  scanTimeoutMs: 10_000,         // default 10s — bound the scan when no device matches
  androidNeverForLocation: true, // default true — opt out of coarse-location on Android 12+
});
const ac = new AbortController();

for await (const dev of transport.scan([GENERIC_HR], { signal: ac.signal })) {
  const conn = await transport.connect(dev.id, GENERIC_HR);
  for await (const packet of conn.heartRate()) {
    console.log(packet.hr);
  }
  break;
}
```

## Options

| Option | Default | Purpose |
|--------|--------:|---------|
| `scanTimeoutMs` | `10000` | Maximum time `scan()` waits before yielding nothing further. Combine with `AbortSignal` for early cancellation. |
| `androidNeverForLocation` | `true` | Adds the `neverForLocation` flag on Android 12+ so the Bluetooth permission does not also request GPS. Set to `false` if you genuinely need location. |
| `client` | auto-loaded `@capacitor-community/bluetooth-le` | Override with a mock `CapacitorBleClient` for tests, or a desktop Capacitor implementation. |

## Testing without a device

`CapacitorBleClient` is exported as an interface — pass an in-memory implementation through `options.client` to exercise UI flows in jsdom or component tests. The package's own tests do exactly this.

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/capacitor/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
