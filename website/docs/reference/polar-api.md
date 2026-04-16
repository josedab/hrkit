---
sidebar_position: 2
title: Polar API Reference
description: Complete API reference for @hrkit/polar — profiles, guards, PMD commands, and parsers.
---

# @hrkit/polar API Reference

## Profiles

| Export | Type | Description |
|--------|------|-------------|
| `POLAR_H10` | `DeviceProfile` | Polar H10 chest strap. ECG + accelerometer. |
| `POLAR_H9` | `DeviceProfile` | Polar H9 chest strap. ECG only. |
| `POLAR_OH1` | `DeviceProfile` | Polar OH1 optical sensor. Accelerometer only. |
| `POLAR_VERITY_SENSE` | `DeviceProfile` | Polar Verity Sense optical sensor. Accelerometer only. |

---

## Guards

### `isPolarConnection(conn)`

Type guard that narrows `HRConnection` to `PolarConnection`.

```typescript
function isPolarConnection(conn: HRConnection): conn is PolarConnection;
```

Returns `true` if the connection's profile includes the PMD service UUID.

---

## PolarConnection

Extends `HRConnection` with PMD-specific methods:

```typescript
interface PolarConnection extends HRConnection {
  ecg(): AsyncIterable<ECGPacket>;
  accelerometer(): AsyncIterable<ACCPacket>;
  requestMTU(mtu: number): Promise<number>;
}
```

---

## PMD Commands

### `buildStartECGCommand()`

Build a command to start ECG streaming at 130Hz, 14-bit resolution.

```typescript
function buildStartECGCommand(): Uint8Array;
```

### `buildStartACCCommand(sampleRate?)`

Build a command to start accelerometer streaming.

```typescript
function buildStartACCCommand(sampleRate?: 25 | 50 | 100 | 200): Uint8Array;
```

Default sample rate: 25Hz.

### `buildStopECGCommand()`

```typescript
function buildStopECGCommand(): Uint8Array;
```

### `buildStopACCCommand()`

```typescript
function buildStopACCCommand(): Uint8Array;
```

### `buildStopCommand(type)`

Stop a measurement by type ID.

```typescript
function buildStopCommand(type: number): Uint8Array;
```

### `buildGetSettingsCommand(type)`

Query measurement settings for a given measurement type.

```typescript
function buildGetSettingsCommand(type: number): Uint8Array;
```

---

## PMD Parsers

### `parseECGData(data)`

Parse a PMD ECG notification frame.

```typescript
function parseECGData(data: DataView): ECGPacket;
```

### `parseACCData(data, sampleRate?)`

Parse a PMD accelerometer notification frame.

```typescript
function parseACCData(data: DataView, sampleRate?: number): ACCPacket;
```

### `parsePMDControlResponse(data)`

Parse a PMD control point response.

```typescript
function parsePMDControlResponse(data: DataView): PMDControlResponse;
```

---

## Types

### `ECGPacket`

```typescript
interface ECGPacket {
  timestamp: number;       // microseconds (device internal clock)
  samples: number[];       // microvolts
  sampleRate: 130;
}
```

### `ACCPacket`

```typescript
interface ACCPacket {
  timestamp: number;       // microseconds
  samples: ACCSample[];
  sampleRate: 25 | 50 | 100 | 200;
}
```

### `ACCSample`

```typescript
interface ACCSample {
  x: number;  // milliG
  y: number;  // milliG
  z: number;  // milliG
}
```

### `PMDControlResponse`

```typescript
interface PMDControlResponse {
  opCode: number;
  measurementType: number;
  status: number;
  success: boolean;
  parameters: Uint8Array;
}
```

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PMD_MEASUREMENT_ECG` | `0x00` | ECG measurement type ID |
| `PMD_MEASUREMENT_ACC` | `0x02` | Accelerometer measurement type ID |
