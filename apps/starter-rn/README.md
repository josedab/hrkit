# @hrkit/starter-rn

A minimal but complete React Native starter template showing how to use **@hrkit/core** and **@hrkit/react-native** for BLE heart rate monitoring.

This is a **source template**, not a runnable Expo project. You create your own Expo app, install @hrkit packages, then copy the `src/` directory to get a working heart rate monitor app.

## What's Included

| Screen | Description |
|--------|-------------|
| **ScanScreen** | Discover nearby BLE heart rate devices with signal strength indicators |
| **SessionScreen** | Live HR display, 5-zone bar, elapsed timer, round tracking, start/pause/stop |
| **HistoryScreen** | Past session cards with avg/max HR, TRIMP, zone distribution mini-bars |

Plus a `useHRKit` hook that wraps `SessionRecorder` for idiomatic React usage.

## Prerequisites

- **Node.js 18+**
- **Expo CLI** (`npm install -g expo-cli`)
- **Physical device** — BLE does not work in simulators/emulators
- A BLE heart rate monitor (Polar, Garmin, Wahoo, etc.)

## Setup

### 1. Create a new Expo project

```bash
npx create-expo-app@latest hrkit-app --template blank-typescript
cd hrkit-app
```

### 2. Install BLE dependencies

```bash
npx expo install react-native-ble-plx expo-dev-client
```

### 3. Install @hrkit packages

```bash
npm install @hrkit/core @hrkit/react-native
```

### 4. Copy the source template

```bash
# From the hrkit monorepo root:
cp -r apps/starter-rn/src/ <your-app>/src/
```

### 5. Update your `App.tsx`

Replace the default `App.tsx` with the import from the template:

```typescript
// App.tsx (project root)
export { default } from './src/App';
```

### 6. Configure BLE permissions

#### iOS — add to `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "This app uses Bluetooth to connect to heart rate monitors."
      }
    }
  }
}
```

#### Android — add to `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "BLUETOOTH_SCAN",
        "BLUETOOTH_CONNECT",
        "ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

## Running on Device

BLE requires a **development build**, not Expo Go:

```bash
# Build and run on iOS device
npx expo run:ios --device

# Build and run on Android device
npx expo run:android --device
```

## Project Structure

```
src/
├── App.tsx                    # Root component with tab navigation
├── screens/
│   ├── ScanScreen.tsx         # BLE device discovery
│   ├── SessionScreen.tsx      # Live HR session recording
│   └── HistoryScreen.tsx      # Past session summaries
└── hooks/
    └── useHRKit.ts            # SessionRecorder React hook
```

## How It Works

### Device Scanning

```typescript
import { BleManager } from 'react-native-ble-plx';
import { ReactNativeTransport } from '@hrkit/react-native';
import { GENERIC_HR } from '@hrkit/core';

const manager = new BleManager();
const transport = new ReactNativeTransport(manager);

for await (const device of transport.scan([GENERIC_HR])) {
  console.log(device.name, device.rssi);
}
```

### Recording a Session

```typescript
import { SessionRecorder, connectToDevice, analyzeSession } from '@hrkit/core';

const recorder = new SessionRecorder({ maxHR: 185, restHR: 50, sex: 'male' });

// Subscribe to real-time data
const unsubHR = recorder.hr$.subscribe((hr) => updateUI(hr));
const unsubZone = recorder.zone$.subscribe((zone) => updateZoneBar(zone));

// Feed packets from BLE connection
const conn = await connectToDevice(transport);
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

// End session and analyze
const session = recorder.end();
const analysis = analyzeSession(session);
// analysis.trimp, analysis.hrv, analysis.zones, etc.
```

### Using the `useHRKit` Hook

```tsx
import { useHRKit } from './hooks/useHRKit';

function MyComponent() {
  const { hr, zone, isRecording, startSession, stopSession, ingestPacket } = useHRKit({
    config: { maxHR: 185, restHR: 50, sex: 'male' },
  });

  return <Text>{hr} BPM — Zone {zone}</Text>;
}
```

## Customization

### Athlete Profile

Edit the `SessionConfig` passed to `useHRKit` or `SessionRecorder`:

```typescript
const config: SessionConfig = {
  maxHR: 190,                         // Required: maximum heart rate
  restHR: 55,                         // Optional: resting heart rate
  sex: 'female',                      // Optional: 'male' | 'female' | 'neutral'
  zones: [0.6, 0.7, 0.8, 0.9],       // Optional: zone thresholds as % of maxHR
};
```

### Zone Colors

Zone colors are defined in `SessionScreen.tsx` — update `ZONE_COLORS` to match your brand:

```typescript
const ZONE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
//                    Zone 1     Zone 2     Zone 3     Zone 4     Zone 5
```

### Adding Navigation

The template uses simple state-based routing. To add a real navigation library:

```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
```

### Session Persistence

The template uses in-memory demo data. To persist sessions, store `Session` objects (returned by `recorder.end()`) using AsyncStorage or a database:

```bash
npx expo install @react-native-async-storage/async-storage
```

## @hrkit API Quick Reference

| Import | Purpose |
|--------|---------|
| `SessionRecorder` | Record HR sessions with round tracking |
| `analyzeSession(session)` | Get TRIMP, HRV, zone distribution |
| `connectToDevice(transport)` | Smart device connection with timeout |
| `ReactNativeTransport` | BLE adapter for react-native-ble-plx |
| `hrToZone(hr, config)` | Convert HR to zone number (1–5) |
| `rmssd(rr)` / `sdnn(rr)` | HRV metrics from RR intervals |
| `filterArtifacts(rr)` | Remove noisy RR intervals |
| `GENERIC_HR` | Generic HR device profile for scanning |

## License

Same as the parent @hrkit monorepo.
