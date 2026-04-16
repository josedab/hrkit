import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

// ── @hrkit imports ──────────────────────────────────────────────────────
// In your real app, use SessionAnalysis from @hrkit/core:
//
// import type { SessionAnalysis, ZoneDistribution } from '@hrkit/core';

interface SessionEntry {
  id: string;
  date: string;
  durationMin: number;
  avgHR: number;
  maxHR: number;
  trimp: number;
  zones: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface Props {
  onBack: () => void;
}

// Demo data — in a real app, load from AsyncStorage or a database.
// Each entry maps to a SessionAnalysis returned by analyzeSession().
const DEMO_SESSIONS: SessionEntry[] = [
  {
    id: '1',
    date: '2024-01-15',
    durationMin: 45,
    avgHR: 152,
    maxHR: 178,
    trimp: 85.3,
    zones: { 1: 5, 2: 10, 3: 15, 4: 12, 5: 3 },
  },
  {
    id: '2',
    date: '2024-01-14',
    durationMin: 60,
    avgHR: 145,
    maxHR: 172,
    trimp: 92.1,
    zones: { 1: 8, 2: 15, 3: 20, 4: 14, 5: 3 },
  },
  {
    id: '3',
    date: '2024-01-12',
    durationMin: 30,
    avgHR: 138,
    maxHR: 165,
    trimp: 45.7,
    zones: { 1: 5, 2: 10, 3: 10, 4: 5, 5: 0 },
  },
];

export function HistoryScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Session History</Text>
      <Text style={styles.subtitle}>
        Review past workouts and training load
      </Text>

      <FlatList
        data={DEMO_SESSIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <View style={styles.statsRow}>
              <Stat label="Duration" value={`${item.durationMin}m`} />
              <Stat label="Avg HR" value={`${item.avgHR}`} />
              <Stat label="Max HR" value={`${item.maxHR}`} />
              <Stat label="TRIMP" value={item.trimp.toFixed(1)} />
            </View>
            <MiniZoneBar zones={item.zones} />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No sessions recorded yet.</Text>
        }
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MiniZoneBar({ zones }: { zones: Record<1 | 2 | 3 | 4 | 5, number> }) {
  const total = Object.values(zones).reduce((a, b) => a + b, 0) || 1;
  const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
  return (
    <View style={styles.miniBar}>
      {([1, 2, 3, 4, 5] as const).map((z) => (
        <View
          key={z}
          style={[
            styles.miniSegment,
            { flex: zones[z] / total, backgroundColor: COLORS[z - 1] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  backButton: { color: '#3b82f6', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  list: { paddingBottom: 20 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  date: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: { alignItems: 'center' },
  statValue: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  miniBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniSegment: { minWidth: 2 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
