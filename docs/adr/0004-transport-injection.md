# ADR 0004: BLE Transport Injection

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

The SDK must work with fundamentally different BLE communication stacks:

- **Web Bluetooth API** (Chrome, Edge, Opera)
- **react-native-ble-plx** (React Native on iOS/Android)
- **Capacitor BLE** (Capacitor hybrid apps)
- **node-ble** (Node.js on Linux via BlueZ D-Bus)
- **ANT+** (a completely different wireless protocol)

Hardcoding any single BLE stack into core creates platform lock-in and
forces every consumer to depend on platform-specific native modules —
even if they only need data analysis or testing.

Additionally, testing BLE-dependent code against real hardware is slow,
flaky, and impossible in CI environments.

## Decision

BLE communication is abstracted behind the `BLETransport` interface:

```ts
interface BLETransport {
  scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice>;
  stopScan(): Promise<void>;
  connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection>;
}
```

Key design choices:

- **`scan()` returns `AsyncIterable`**, allowing consumers to use
  `for await...of` for natural, pull-based device discovery.
- **`connect()` returns an `HRConnection`** that provides `hr$` (heart
  rate stream), `battery$`, and `disconnect()`.
- **`DeviceProfile`** describes device capabilities declaratively.
  Consumer code requests capabilities, not specific devices.

Platform adapter packages implement this interface:

| Package                    | BLE Stack              |
|----------------------------|------------------------|
| `@hrkit/web`               | Web Bluetooth API      |
| `@hrkit/react-native`      | react-native-ble-plx   |
| `@hrkit/capacitor`         | Capacitor Web shim     |
| `@hrkit/capacitor-native`  | Capacitor native BLE   |
| `@hrkit/ant`               | ANT+ protocol          |

`MockTransport` in core enables testing without hardware by accepting
in-memory data arrays (not file paths — no file system dependency).

## Consequences

### Positive

- Core runs on any JavaScript runtime with no platform imports.
- Same application code works across platforms — only the transport
  injection changes.
- Tests use `MockTransport` with deterministic data — no hardware
  dependency, fast and reliable in CI.
- Custom transports can bridge any BLE stack, WebSocket relay, or
  even non-BLE data sources (e.g. file replay, ANT+).

### Negative / trade-offs

- Two packages are required per platform (`core` + adapter), which
  adds a setup step for new consumers.
- Adapter authors must implement the full `BLETransport` interface
  correctly. There is no abstract base class with partial defaults.
- `AsyncIterable` for `scan()` provides no built-in backpressure
  mechanism. Fast-scanning environments may need consumer-side
  throttling.

## Alternatives considered

1. **React Native-first with shims for other platforms.** Rejected
   because it creates platform lock-in and forces Web/Node consumers
   to depend on React Native abstractions.

2. **Abstract class with partial implementation.** Rejected because
   abstract classes don't compose well in TypeScript (single
   inheritance), and partial defaults encourage incorrect
   implementations that "work" but miss edge cases.

3. **Event emitter API (`on('device', cb)`).**  Rejected because it
   loses the type safety and composability of `AsyncIterable`. Event
   emitters also make it harder to implement scan cancellation and
   cleanup.

## References

- Interface definition: `packages/core/src/types.ts` (`BLETransport`)
- Test transport: `packages/core/src/mock-transport.ts`
- Web adapter: `packages/web/src/index.ts`
- React Native adapter: `packages/react-native/src/index.ts`
