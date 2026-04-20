// swift-tools-version: 5.9
import PackageDescription

// HRKit iOS — Swift package wrapping CoreBluetooth and exposing the same
// HR/HRV/zone primitives as @hrkit/core. The Swift API mirrors the JS API
// where reasonable; differences are documented per-symbol.
//
// Status: SCAFFOLD. The HR-measurement parser is implemented and unit-tested.
// Live BLE scanning will land once paired with a real device test rig.

let package = Package(
    name: "HRKit",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "HRKit", targets: ["HRKit"])
    ],
    targets: [
        .target(name: "HRKit"),
        .testTarget(name: "HRKitTests", dependencies: ["HRKit"]),
    ]
)
