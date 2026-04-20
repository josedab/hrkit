# HRKit Android

Native Kotlin binding for HRKit. Wraps `android.bluetooth.*` and exposes the
same HR/HRV/zone primitives as `@hrkit/core`.

> **Status: SCAFFOLD.** The GATT HR-measurement parser is implemented and
> unit-tested. Live BLE scanning lands once paired with a real-device test
> rig. Use the JS SDK / `@hrkit/react-native` for production today.

## Build

```bash
cd bindings/android
./gradlew test
```

Requires JDK 17 (project toolchain pins this).

## Usage sketch

```kotlin
import dev.hrkit.HeartRateParser

val packet = HeartRateParser.parse(characteristic.value, System.currentTimeMillis())
println("HR: ${packet.hr} bpm")
```

## Roadmap

- `BLEScanner` and `HRConnection` over `BluetoothLeScanner` + `BluetoothGatt`.
- Coroutine `Flow<HRPacket>` for hot streams.
- Port `rmssd`, `sdnn`, `hrToZone`, `analyzeSession` from the JS impl.
- CI fixture-replay against shared `fixtures/conformance/` to guarantee
  parity with the JS parser.
