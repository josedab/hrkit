# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-16

### Added
- **Error hierarchy**: `HRKitError`, `ParseError`, `ConnectionError`, `TimeoutError`, `DeviceNotFoundError` for structured error handling.
- **GATT parser bounds checking**: validates DataView length before parsing, throws `ParseError` on truncated data.
- **Session serialization**: `sessionToJSON()`, `sessionFromJSON()`, `sessionToCSV()`, `roundsToCSV()`.
- **Session analysis**: `analyzeSession()` one-call convenience function for post-session metrics.
- **TCX export**: `sessionToTCX()` for Strava/Garmin Connect/TrainingPeaks integration.
- **SessionRecorder enhancements**: `pause()`/`resume()`, `setDeviceInfo()`, `setMetadata()`, packet-based timestamps.
- **Schema versioning**: `schemaVersion` field on Session for forward compatibility.
- **Data validation**: `validateHRPacket()` with configurable HR/RR ranges.
- **Connection management**: `connectWithReconnect()` with exponential backoff and `ConnectionState` observable.
- **Streaming metrics**: `RollingRMSSD` and `TRIMPAccumulator` for real-time windowed HRV and TRIMP.
- **Real-time artifact detection**: `RealtimeArtifactDetector` with `artifacts$` observable stream.
- **Zone presets**: `ZONE_PRESETS` (5-zone, 3-zone) and unified `AthleteProfile` type with `toSessionConfig()`, `toZoneConfig()`, `toTRIMPConfig()`.
- **Re-exported `GENERIC_HR`** from `@hrkit/core` main entry (no longer requires `/profiles` subpath).
- **Adapter crash safety**: both web and react-native adapters wrap `parseHeartRate()` in try-catch.
- **CI pipeline**: GitHub Actions workflow for Node.js 18/20/22 matrix (test, lint, build).
- **MIT LICENSE file**.

### Fixed
- `weeklyTRIMP()` now accepts a `sex` parameter instead of hardcoding `'neutral'`.
- `SessionRecorder` uses packet timestamps instead of `Date.now()` for accurate timing in replay.

### Removed
- Unused `@anthropic-ai/sdk` dev dependency.

## [0.1.0] - 2026-04-16

### Added
- Core GATT HR parser with 1/1024s → ms conversion.
- HRV metrics: `rmssd()`, `sdnn()`, `pnn50()`, `meanHR()`, `hrBaseline()`, `readinessVerdict()`.
- 5-zone HR model with `hrToZone()` and `zoneDistribution()`.
- Bannister's TRIMP with `trimp()` and `weeklyTRIMP()`.
- Artifact filter with remove/interpolate strategies.
- `SessionRecorder` with round tracking and observable streams.
- `connectToDevice()` with prefer/fallback device selection.
- `MockTransport` for testing without BLE hardware.
- Device profiles: `GENERIC_HR`, Polar H10/H9/OH1/Verity Sense.
- `@hrkit/polar` package with PMD protocol parsers.
- `@hrkit/web` adapter for Web Bluetooth API.
- `@hrkit/react-native` adapter for react-native-ble-plx.
