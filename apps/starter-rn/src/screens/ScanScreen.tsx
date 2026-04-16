import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

// ── @hrkit imports ──────────────────────────────────────────────────────
// In your real app, uncomment these and remove the demo HRDevice type:
//
// import type { HRDevice } from '@hrkit/core';
// import { GENERIC_HR } from '@hrkit/core';
// import { ReactNativeTransport } from '@hrkit/react-native';
// import { BleManager } from 'react-native-ble-plx';

/** Placeholder type — replace with `HRDevice` from @hrkit/core */
interface HRDevice {
  id: string;
  name: string;
  rssi: number;
}

interface Props {
  onDeviceSelected: (id: string, name: string) => void;
}

export function ScanScreen({ onDeviceSelected }: Props) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<HRDevice[]>([]);

  const startScan = useCallback(async () => {
    setScanning(true);
    setDevices([]);

    // ── Real BLE scanning ───────────────────────────────────────────────
    // Replace the demo timeout below with actual @hrkit scanning:
    //
    // const manager = new BleManager();
    // const transport = new ReactNativeTransport(manager);
    //
    // for await (const device of transport.scan([GENERIC_HR])) {
    //   setDevices(prev => {
    //     if (prev.some(d => d.id === device.id)) return prev;
    //     return [...prev, device];
    //   });
    // }
    // setScanning(false);

    // ── Demo: simulate device discovery ─────────────────────────────────
    setTimeout(() => {
      setDevices([
        { id: 'polar-h10-abc123', name: 'Polar H10 ABC123', rssi: -45 },
        { id: 'wahoo-tickr-7890', name: 'TICKR X 7890', rssi: -62 },
        { id: 'garmin-hrm-dual', name: 'HRM-Dual', rssi: -71 },
      ]);
      setScanning(false);
    }, 2000);
  }, []);

  const renderDevice = ({ item }: { item: HRDevice }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => onDeviceSelected(item.id, item.name)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <View style={styles.rssiContainer}>
        <Text style={styles.rssi}>{item.rssi} dBm</Text>
        <SignalBars rssi={item.rssi} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Heart Rate Devices</Text>
      <Text style={styles.subtitle}>Scan for nearby BLE heart rate monitors</Text>

      <TouchableOpacity
        style={[styles.scanButton, scanning && styles.scanButtonActive]}
        onPress={startScan}
        disabled={scanning}
      >
        {scanning ? (
          <View style={styles.scanningRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.scanButtonText}> Scanning…</Text>
          </View>
        ) : (
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        )}
      </TouchableOpacity>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !scanning ? (
            <Text style={styles.emptyText}>No devices found. Tap scan to search.</Text>
          ) : null
        }
      />
    </View>
  );
}

function SignalBars({ rssi }: { rssi: number }) {
  const bars = rssi > -50 ? 4 : rssi > -60 ? 3 : rssi > -70 ? 2 : 1;
  return (
    <View style={styles.signalBars}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[styles.bar, { height: 4 + i * 3 }, i <= bars && styles.barActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  scanButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonActive: { backgroundColor: '#1e40af' },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanningRow: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingBottom: 20 },
  deviceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: { flex: 1 },
  deviceName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  deviceId: { color: '#64748b', fontSize: 12, marginTop: 2 },
  rssiContainer: { alignItems: 'flex-end' },
  rssi: { color: '#94a3b8', fontSize: 12 },
  signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 4 },
  bar: { width: 4, backgroundColor: '#334155', borderRadius: 1 },
  barActive: { backgroundColor: '#22c55e' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
