import { describe, it, expect } from 'vitest';
import {
  MockTransport,
  SessionRecorder,
  connectToDevice,
  rmssd,
  trimp,
  zoneDistribution,
  filterArtifacts,
} from '../index.js';
import { GENERIC_HR } from '../profiles/index.js';
import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID } from '../types.js';
import {
  BJJ_SESSION_FIXTURE,
  REST_READING_FIXTURE,
  CYCLING_HR_ONLY_FIXTURE,
  RR_WITH_ARTIFACTS,
} from './fixtures/index.js';

const POLAR_H10_PROFILE: DeviceProfile = {
  brand: 'Polar',
  model: 'H10',
  namePrefix: 'Polar H10',
  capabilities: ['heartRate', 'rrIntervals', 'ecg', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

describe('Integration: Full BJJ session workflow', () => {
  it('scans, connects, records session with rounds, and computes metrics', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    // Connect
    const conn = await connectToDevice(transport, {
      prefer: [POLAR_H10_PROFILE],
      timeoutMs: 5000,
    });

    expect(conn.deviceName).toContain('Polar H10');
    expect(conn.profile.capabilities).toContain('ecg');

    // Record session
    const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

    const hrValues: number[] = [];
    recorder.hr$.subscribe((hr) => hrValues.push(hr));

    // Simulate 2 rounds
    let packetCount = 0;
    recorder.startRound({ label: 'Round 1' });

    for await (const packet of conn.heartRate()) {
      recorder.ingest(packet);
      packetCount++;

      // End round 1 halfway through
      if (packetCount === 10) {
        recorder.endRound();
        recorder.startRound({ label: 'Round 2' });
      }
    }
    recorder.endRound();

    const session = recorder.end();

    // Verify session structure
    expect(session.samples).toHaveLength(20);
    expect(session.rounds).toHaveLength(2);
    expect(session.rounds[0]!.meta?.label).toBe('Round 1');
    expect(session.rounds[1]!.meta?.label).toBe('Round 2');
    expect(session.rounds[0]!.samples).toHaveLength(10);
    expect(session.rounds[1]!.samples).toHaveLength(10);

    // Verify observable emitted all values
    expect(hrValues).toHaveLength(20);

    // Compute HRV from session RR intervals
    const hrvValue = rmssd(session.rrIntervals);
    expect(hrvValue).toBeGreaterThan(0);

    // Compute TRIMP
    const sessionTRIMP = trimp(session.samples, {
      maxHR: 185,
      restHR: 48,
      sex: 'male',
    });
    expect(sessionTRIMP).toBeGreaterThan(0);

    // Compute zone distribution
    const zones = zoneDistribution(session.samples, {
      maxHR: 185,
      zones: [0.6, 0.7, 0.8, 0.9],
    });
    expect(zones.total).toBeGreaterThan(0);

    // Should have time in multiple zones (BJJ is variable intensity)
    const nonZeroZones = Object.values(zones.zones).filter((v) => v > 0).length;
    expect(nonZeroZones).toBeGreaterThanOrEqual(2);
  });

  it('works with generic HR strap (no RR intervals)', async () => {
    const transport = new MockTransport(CYCLING_HR_ONLY_FIXTURE);

    const conn = await connectToDevice(transport, {
      prefer: [GENERIC_HR],
      timeoutMs: 5000,
    });

    const recorder = new SessionRecorder({ maxHR: 200, restHR: 50 });

    for await (const packet of conn.heartRate()) {
      recorder.ingest(packet);
    }

    const session = recorder.end();

    expect(session.samples).toHaveLength(10);
    expect(session.rrIntervals).toHaveLength(0); // no RR intervals

    // Zone distribution still works from HR samples
    const zones = zoneDistribution(session.samples, {
      maxHR: 200,
      zones: [0.6, 0.7, 0.8, 0.9],
    });
    expect(zones.total).toBeGreaterThan(0);
  });

  it('computes HRV baseline from rest readings', async () => {
    const transport = new MockTransport(REST_READING_FIXTURE);
    const conn = await transport.connect('h10-002', POLAR_H10_PROFILE);

    const allRR: number[] = [];
    for await (const packet of conn.heartRate()) {
      allRR.push(...packet.rrIntervals);
    }

    const hrvValue = rmssd(allRR);
    expect(hrvValue).toBeGreaterThan(0);

    // Clean data should have low artifact rate
    const { artifactRate } = filterArtifacts(allRR);
    expect(artifactRate).toBe(0);
  });

  it('filters artifacts from noisy RR data', () => {
    const { filtered, artifactRate } = filterArtifacts(RR_WITH_ARTIFACTS, {
      strategy: 'remove',
    });

    // Artifacts removed
    expect(artifactRate).toBeGreaterThan(0.1);
    expect(filtered.length).toBeLessThan(RR_WITH_ARTIFACTS.length);

    // Filtered HRV should be reasonable
    const cleanHRV = rmssd(filtered);
    expect(cleanHRV).toBeGreaterThan(0);
    expect(cleanHRV).toBeLessThan(100); // clean data should have modest HRV
  });

  it('handles prefer/fallback device selection', async () => {
    // Only a generic strap available, but Polar is preferred
    const transport = new MockTransport(CYCLING_HR_ONLY_FIXTURE);

    const conn = await connectToDevice(transport, {
      prefer: [POLAR_H10_PROFILE],
      fallback: GENERIC_HR,
      timeoutMs: 5000,
    });

    // Should fall back to generic
    expect(conn.profile.brand).toBe('Generic');
    expect(conn.profile.capabilities).not.toContain('ecg');
  });
});
