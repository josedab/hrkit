# HRKit iOS

Native Swift binding for HRKit. Wraps CoreBluetooth and exposes the same
HR/HRV/zone primitives as `@hrkit/core`.

> **Status: SCAFFOLD.** The GATT HR-measurement parser is implemented and
> unit-tested. Live BLE scanning lands once a paired device test rig is in
> place. Use the JS SDK for production today.

## Install

In Xcode: **File → Add Package Dependencies…** and point at this repo,
selecting the `bindings/ios/` directory.

```swift
import HRKit

let packet = try HeartRateParser.parse(notification.value!, timestamp: Date().timeIntervalSince1970)
print("HR: \(packet.hr) bpm")
```

## Roadmap

- `BLEScanner` and `HRConnection` actors over CoreBluetooth.
- `Session` recorder + Combine publishers (`hr$`, `zone$`).
- HRV (`rmssd`, `sdnn`) ports of `@hrkit/core` math.
- Verify outputs against the JS impl using shared fixtures from
  `fixtures/conformance/`.
