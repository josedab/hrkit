import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ── @hrkit imports ──────────────────────────────────────────────────────
// In your real app, uncomment these and wire up BLE:
//
// import { SessionRecorder, analyzeSession, connectToDevice } from '@hrkit/core';
// import type { SessionConfig, HRPacket, SessionAnalysis } from '@hrkit/core';
// import { ReactNativeTransport } from '@hrkit/react-native';
// import { BleManager } from 'react-native-ble-plx';
//
// Or use the provided hook:
// import { useHRKit } from '../hooks/useHRKit';

interface Props {
  deviceId: string;
  deviceName: string;
  onBack: () => void;
  onSessionEnd: () => void;
}

const ZONE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
const ZONE_LABELS = ['Recovery', 'Aerobic', 'Tempo', 'Threshold', 'VO₂ Max'];

export function SessionScreen({ deviceId: _deviceId, deviceName, onBack, onSessionEnd }: Props) {
  const [hr, setHR] = useState(0);
  const [zone, setZone] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [inRound, setInRound] = useState(false);
  const _timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real app integration ──────────────────────────────────────────────
  // Replace the demo timer with actual @hrkit session recording:
  //
  // const { hr, zone, isRecording, isPaused, elapsed,
  //         startSession, stopSession, pauseSession, resumeSession,
  //         ingestPacket, startRound, endRound } = useHRKit({
  //   config: { maxHR: 185, restHR: 50, sex: 'male' },
  // });
  //
  // useEffect(() => {
  //   // Connect to BLE device and feed packets
  //   const manager = new BleManager();
  //   const transport = new ReactNativeTransport(manager);
  //   let cancelled = false;
  //
  //   (async () => {
  //     const conn = await transport.connect(deviceId, GENERIC_HR);
  //     startSession();
  //     for await (const packet of conn.heartRate()) {
  //       if (cancelled) break;
  //       ingestPacket(packet);
  //     }
  //   })();
  //
  //   return () => { cancelled = true; };
  // }, [deviceId]);

  // ── Demo: simulated HR data ───────────────────────────────────────────
  useEffect(() => {
    if (!recording || paused) return;

    const interval = setInterval(() => {
      const simulatedHR = 120 + Math.floor(Math.random() * 60);
      setHR(simulatedHR);
      setZone(simulatedHR < 130 ? 1 : simulatedHR < 145 ? 2 : simulatedHR < 160 ? 3 : simulatedHR < 175 ? 4 : 5);
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [recording, paused]);

  const handleStart = useCallback(() => {
    setRecording(true);
    setPaused(false);
    setElapsed(0);
    setHR(0);
    setZone(0);
    setRoundCount(0);
    setInRound(false);
  }, []);

  const handlePauseResume = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  const handleStop = useCallback(() => {
    setRecording(false);
    setPaused(false);

    // In a real app, call stopSession() to get SessionAnalysis:
    // const analysis = stopSession();
    // if (analysis) {
    //   console.log('TRIMP:', analysis.trimp);
    //   console.log('HRV rMSSD:', analysis.hrv?.rmssd);
    //   console.log('Zone distribution:', analysis.zones);
    // }

    onSessionEnd();
  }, [onSessionEnd]);

  const handleRoundToggle = useCallback(() => {
    if (inRound) {
      // recorder.endRound();
      setRoundCount((prev) => prev + 1);
      setInRound(false);
    } else {
      // recorder.startRound({ label: `Round ${roundCount + 1}` });
      setInRound(true);
    }
  }, [inRound, roundCount]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.deviceLabel}>{deviceName}</Text>

      {/* HR Display */}
      <View style={styles.hrContainer}>
        <Text style={[styles.hrValue, { color: zone > 0 ? ZONE_COLORS[zone - 1] : '#f8fafc' }]}>{hr || '--'}</Text>
        <Text style={styles.hrUnit}>BPM</Text>
        {zone > 0 && <Text style={[styles.zoneName, { color: ZONE_COLORS[zone - 1] }]}>{ZONE_LABELS[zone - 1]}</Text>}
      </View>

      {/* Zone Bar */}
      <View style={styles.zoneBar}>
        {([1, 2, 3, 4, 5] as const).map((z) => (
          <View
            key={z}
            style={[styles.zoneSegment, { backgroundColor: ZONE_COLORS[z - 1] }, zone !== z && styles.zoneDimmed]}
          >
            <Text style={styles.zoneLabel}>Z{z}</Text>
          </View>
        ))}
      </View>

      {/* Timer */}
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>

      {/* Controls */}
      <View style={styles.controls}>
        {!recording ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.pauseButton} onPress={handlePauseResume}>
              <Text style={styles.buttonText}>{paused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Round Controls */}
      {recording && (
        <View style={styles.roundControls}>
          <TouchableOpacity
            style={[styles.roundButton, inRound && styles.roundButtonActive]}
            onPress={handleRoundToggle}
          >
            <Text style={styles.roundButtonText}>{inRound ? 'End Round' : 'Start Round'}</Text>
          </TouchableOpacity>
          <Text style={styles.roundInfo}>
            {inRound ? `Round ${roundCount + 1} in progress` : `Rounds completed: ${roundCount}`}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  backButton: { color: '#3b82f6', fontSize: 16, marginBottom: 8 },
  deviceLabel: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
  hrContainer: { alignItems: 'center', marginVertical: 30 },
  hrValue: { fontSize: 96, fontWeight: '700', lineHeight: 100 },
  hrUnit: { fontSize: 18, color: '#64748b', marginTop: 4 },
  zoneName: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  zoneBar: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    height: 32,
    marginVertical: 20,
  },
  zoneSegment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoneDimmed: { opacity: 0.3 },
  zoneLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#f8fafc',
    textAlign: 'center',
    marginVertical: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  pauseButton: {
    backgroundColor: '#eab308',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  roundControls: { alignItems: 'center', marginTop: 20 },
  roundButton: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  roundButtonActive: { backgroundColor: '#3b82f6' },
  roundButtonText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  roundInfo: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
});
