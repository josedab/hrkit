import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HistoryScreen } from './screens/HistoryScreen';
import { ScanScreen } from './screens/ScanScreen';
import { SessionScreen } from './screens/SessionScreen';

type Screen = 'scan' | 'session' | 'history';

export default function App() {
  const [screen, setScreen] = useState<Screen>('scan');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');

  const handleDeviceSelected = (id: string, name: string) => {
    setDeviceId(id);
    setDeviceName(name);
    setScreen('session');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {screen === 'scan' && <ScanScreen onDeviceSelected={handleDeviceSelected} />}
        {screen === 'session' && deviceId && (
          <SessionScreen
            deviceId={deviceId}
            deviceName={deviceName}
            onBack={() => setScreen('scan')}
            onSessionEnd={() => setScreen('history')}
          />
        )}
        {screen === 'history' && <HistoryScreen onBack={() => setScreen('scan')} />}
      </View>
      <View style={styles.tabBar}>
        <TabButton label="Scan" active={screen === 'scan'} onPress={() => setScreen('scan')} />
        <TabButton label="Session" active={screen === 'session'} onPress={() => deviceId && setScreen('session')} />
        <TabButton label="History" active={screen === 'history'} onPress={() => setScreen('history')} />
      </View>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.activeTab]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderTopWidth: 2, borderTopColor: '#3b82f6' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  activeTabText: { color: '#3b82f6' },
});
