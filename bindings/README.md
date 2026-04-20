# Native bindings

Native-language bindings for `@hrkit`. Each subdirectory is an independent
package with its own toolchain.

| Path | Language | Toolchain | Status |
|------|----------|-----------|--------|
| [`ios/`](./ios/) | Swift 5.9+ | SwiftPM, iOS 15+ | SCAFFOLD — parser + tests |
| [`android/`](./android/) | Kotlin 1.9+ | Gradle 8.x, JDK 17 | SCAFFOLD — parser + tests |

## Why scaffolds?

The JS / React Native packages are the production target today. These
bindings exist so the surface area is staked out and the GATT parser is
verifiable against the same `fixtures/conformance/` corpus that the JS impl
uses — guaranteeing byte-for-byte parity when the live BLE scanner work
lands.

Real CoreBluetooth / BluetoothLeScanner integration requires a paired
device test rig (Xcode + iOS device, Android Studio + Android device) and
is not part of this scaffold.

## Roadmap (per binding)

1. Live `BLEScanner` and `HRConnection` over the platform BLE stack.
2. Reactive streams (`Combine` on iOS, `Flow` on Android).
3. Port the HRV / TRIMP / zone math.
4. CI fixture-replay job that validates parser parity against `@hrkit/core`.
