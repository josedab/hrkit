/**
 * @hrkit BJJ Rolling Intensity — Reference Implementation
 *
 * This demonstrates the full SDK workflow:
 *   1. Scan and connect to a BLE HR device (prefer Polar H10, fallback to any)
 *   2. Record a multi-round BJJ sparring session
 *   3. Compute per-round and session-level metrics
 *   4. Optionally stream ECG on Polar devices
 *
 * This file uses MockTransport to demonstrate the API without hardware.
 * In a real app, replace MockTransport with ReactNativeTransport or WebBluetoothTransport.
 */

import type { HRPacket } from '@hrkit/core';
import {
  connectToDevice,
  filterArtifacts,
  hrBaseline,
  MockTransport,
  meanHR,
  readinessVerdict,
  rmssd,
  SessionRecorder,
  sdnn,
  trimp,
  zoneDistribution,
} from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { isPolarConnection, POLAR_H10 } from '@hrkit/polar';

// ── Mock fixture data (simulating a real BJJ session) ───────────────────

const BJJ_FIXTURE = {
  device: { id: 'h10-demo', name: 'Polar H10 DEMO123', rssi: -45 },
  packets: [
    // Warmup
    { timestamp: 0, hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 1000, hr: 78, rrIntervals: [769], contactDetected: true },
    { timestamp: 2000, hr: 85, rrIntervals: [706], contactDetected: true },
    // Round 1 - active sparring
    { timestamp: 3000, hr: 110, rrIntervals: [545], contactDetected: true },
    { timestamp: 4000, hr: 128, rrIntervals: [469], contactDetected: true },
    { timestamp: 5000, hr: 145, rrIntervals: [414], contactDetected: true },
    { timestamp: 6000, hr: 158, rrIntervals: [380], contactDetected: true },
    { timestamp: 7000, hr: 172, rrIntervals: [349], contactDetected: true },
    { timestamp: 8000, hr: 178, rrIntervals: [337], contactDetected: true },
    { timestamp: 9000, hr: 175, rrIntervals: [343], contactDetected: true },
    // Rest between rounds
    { timestamp: 10000, hr: 155, rrIntervals: [387], contactDetected: true },
    { timestamp: 11000, hr: 140, rrIntervals: [429], contactDetected: true },
    { timestamp: 12000, hr: 125, rrIntervals: [480], contactDetected: true },
    // Round 2 - active sparring
    { timestamp: 13000, hr: 135, rrIntervals: [444], contactDetected: true },
    { timestamp: 14000, hr: 152, rrIntervals: [395], contactDetected: true },
    { timestamp: 15000, hr: 168, rrIntervals: [357], contactDetected: true },
    { timestamp: 16000, hr: 175, rrIntervals: [343], contactDetected: true },
    { timestamp: 17000, hr: 180, rrIntervals: [333], contactDetected: true },
    { timestamp: 18000, hr: 170, rrIntervals: [353], contactDetected: true },
    { timestamp: 19000, hr: 160, rrIntervals: [375], contactDetected: true },
  ] as HRPacket[],
};

// ── Athlete configuration ───────────────────────────────────────────────

const ATHLETE_CONFIG = {
  maxHR: 185,
  restHR: 48,
  sex: 'male' as const,
};

const ZONE_CONFIG = {
  maxHR: ATHLETE_CONFIG.maxHR,
  zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number],
};

// ── Simulated baseline HRV readings (last 7 days) ──────────────────────

const dailyReadings = [
  { date: '2024-01-08', rmssd: 62 },
  { date: '2024-01-09', rmssd: 58 },
  { date: '2024-01-10', rmssd: 65 },
  { date: '2024-01-11', rmssd: 55 },
  { date: '2024-01-12', rmssd: 60 },
  { date: '2024-01-13', rmssd: 63 },
  { date: '2024-01-14', rmssd: 59 },
];

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  @hrkit BJJ Rolling Intensity — Reference Implementation');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Step 1: Pre-session readiness check ─────────────────────────────

  console.log('📊 Pre-Session Readiness Check');
  console.log('─────────────────────────────');

  const baseline = hrBaseline(dailyReadings, 7);
  console.log(`  7-day HRV baseline (rMSSD): ${baseline?.toFixed(1)} ms`);

  // Simulate today's morning reading
  const todayRmssd = 58;
  console.log(`  Today's rMSSD: ${todayRmssd} ms`);

  const verdict = readinessVerdict(todayRmssd, baseline!);
  const verdictEmoji = { go_hard: '🟢', moderate: '🟡', rest: '🔴' };
  console.log(`  Verdict: ${verdictEmoji[verdict]} ${verdict.toUpperCase()}\n`);

  // ── Step 2: Connect to device ──────────────────────────────────────

  console.log('📡 Connecting to BLE device...');
  const transport = new MockTransport(BJJ_FIXTURE);

  const conn = await connectToDevice(transport, {
    prefer: [POLAR_H10],
    fallback: GENERIC_HR,
    timeoutMs: 5000,
  });

  console.log(`  Connected: ${conn.deviceName}`);
  console.log(`  Profile: ${conn.profile.brand} ${conn.profile.model}`);
  console.log(`  Capabilities: ${conn.profile.capabilities.join(', ')}`);

  // Check for Polar ECG capability
  if (isPolarConnection(conn) && conn.profile.capabilities.includes('ecg')) {
    console.log('  ✅ ECG streaming available');
  } else {
    console.log('  ℹ️  Standard HR mode (no ECG)');
  }
  console.log();

  // ── Step 3: Record session ─────────────────────────────────────────

  console.log('🥋 Starting BJJ Session');
  console.log('─────────────────────────────');

  const recorder = new SessionRecorder({
    maxHR: ATHLETE_CONFIG.maxHR,
    restHR: ATHLETE_CONFIG.restHR,
    zones: ZONE_CONFIG.zones,
  });

  // Track zone changes
  let lastZone = 0;
  recorder.zone$.subscribe((zone) => {
    if (zone !== lastZone) {
      lastZone = zone;
    }
  });

  // Simulate session with 2 rounds
  let packetIndex = 0;
  recorder.startRound({ label: 'Round 1 — Sparring' });

  for await (const packet of conn.heartRate()) {
    recorder.ingest(packet);
    packetIndex++;

    // End round 1, rest, start round 2
    if (packetIndex === 10) {
      const round1 = recorder.endRound();
      console.log(`  Round 1 complete: ${round1.samples.length} samples`);
    }
    if (packetIndex === 13) {
      recorder.startRound({ label: 'Round 2 — Sparring' });
    }
  }

  // End round 2 if still in progress
  if (packetIndex > 13) {
    const round2 = recorder.endRound();
    console.log(`  Round 2 complete: ${round2.samples.length} samples`);
  }

  const session = recorder.end();
  console.log(`\n  Session ended: ${session.samples.length} total samples`);
  console.log(`  Duration: ${((session.endTime - session.startTime) / 1000).toFixed(0)}s`);
  console.log(`  Rounds: ${session.rounds.length}`);
  console.log();

  // ── Step 4: Post-session analysis ──────────────────────────────────

  console.log('📈 Session Analysis');
  console.log('─────────────────────────────');

  // Artifact filtering
  const { filtered: cleanRR, artifactRate } = filterArtifacts(session.rrIntervals);
  console.log(`  RR intervals: ${session.rrIntervals.length} (${(artifactRate * 100).toFixed(1)}% artifacts)`);

  // HRV
  const sessionRMSSD = rmssd(cleanRR);
  const sessionSDNN = sdnn(cleanRR);
  const avgHR = meanHR(cleanRR);
  console.log(`  Mean HR: ${avgHR.toFixed(0)} bpm`);
  console.log(`  HRV (rMSSD): ${sessionRMSSD.toFixed(1)} ms`);
  console.log(`  HRV (SDNN): ${sessionSDNN.toFixed(1)} ms`);

  // TRIMP
  const sessionTRIMP = trimp(session.samples, {
    maxHR: ATHLETE_CONFIG.maxHR,
    restHR: ATHLETE_CONFIG.restHR,
    sex: ATHLETE_CONFIG.sex,
  });
  console.log(`  TRIMP: ${sessionTRIMP.toFixed(1)}`);

  // Zone distribution
  const zones = zoneDistribution(session.samples, ZONE_CONFIG);
  console.log('\n  Zone Distribution:');
  for (const [zone, seconds] of Object.entries(zones.zones)) {
    const pct = zones.total > 0 ? ((seconds / zones.total) * 100).toFixed(0) : '0';
    const bar = '█'.repeat(Math.round((seconds / zones.total) * 20));
    console.log(`    Zone ${zone}: ${seconds.toFixed(0)}s (${pct}%) ${bar}`);
  }

  // ── Step 5: Per-round breakdown ────────────────────────────────────

  console.log('\n📋 Round-by-Round Breakdown');
  console.log('─────────────────────────────');

  for (const round of session.rounds) {
    const roundRR = round.rrIntervals;
    const roundHRV = rmssd(roundRR);
    const roundZones = zoneDistribution(round.samples, ZONE_CONFIG);
    const peakHR = Math.max(...round.samples.map((s) => s.hr));
    const roundTRIMP = trimp(round.samples, {
      maxHR: ATHLETE_CONFIG.maxHR,
      restHR: ATHLETE_CONFIG.restHR,
      sex: ATHLETE_CONFIG.sex,
    });

    console.log(`\n  ${round.meta?.label ?? `Round ${round.index + 1}`}:`);
    console.log(`    Duration: ${((round.endTime - round.startTime) / 1000).toFixed(0)}s`);
    console.log(`    Peak HR: ${peakHR} bpm`);
    console.log(`    HRV: ${roundHRV.toFixed(1)} ms`);
    console.log(`    TRIMP: ${roundTRIMP.toFixed(1)}`);

    const topZone = (Object.entries(roundZones.zones) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    if (topZone && topZone[1] > 0) {
      console.log(`    Primary zone: Zone ${topZone[0]}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Session complete! 🎉');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
