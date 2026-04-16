import { describe, expect, it } from 'vitest';
import type { HRKitPlugin, HRPacket } from '../index.js';
import {
  analyzeSession,
  GroupSession,
  InMemoryAthleteStore,
  PluginRegistry,
  SessionRecorder,
  tabataProtocol,
  WorkoutEngine,
} from '../index.js';

describe('feature integration', () => {
  it('plugin + session recorder + athlete store + insights', () => {
    // 1. Create a plugin that counts packets
    let packetCount = 0;
    const counterPlugin: HRKitPlugin = {
      name: 'counter',
      version: '1.0',
      onPacket: () => {
        packetCount++;
        return undefined;
      },
      onAnalyze: () => ({ customPacketCount: packetCount }),
    };

    const registry = new PluginRegistry();
    registry.register(counterPlugin);

    // 2. Record a session with plugin processing
    const recorder = new SessionRecorder({ maxHR: 185, restHR: 60 });
    const packets: HRPacket[] = [];
    for (let i = 0; i < 20; i++) {
      const packet: HRPacket = {
        timestamp: i * 1000,
        hr: 120 + i * 2,
        rrIntervals: [800 - i * 5],
        contactDetected: true,
      };
      const processed = registry.processPacket(packet);
      recorder.ingest(processed);
      packets.push(processed);
    }

    // 3. End session and analyze
    const session = recorder.end();
    const analysis = analyzeSession(session);
    const customMetrics = registry.collectAnalytics(session);

    expect(analysis.sampleCount).toBe(20);
    expect(customMetrics.customPacketCount).toBe(20);

    // 4. Store in athlete store
    const store = new InMemoryAthleteStore();
    const sessionId = store.saveSession(session);
    expect(store.getSessionCount()).toBe(1);

    const summary = store.getSession(sessionId)!;
    expect(summary.meanHR).toBeGreaterThan(0);
    expect(summary.trimp).toBeGreaterThan(0);
  });

  it('workout engine + group session', () => {
    const group = new GroupSession();
    group.addAthlete({ id: 'a1', name: 'Alice', config: { maxHR: 185, restHR: 60 } });
    group.addAthlete({ id: 'a2', name: 'Bob', config: { maxHR: 190, restHR: 55 } });

    const engine = new WorkoutEngine(tabataProtocol(), { maxHR: 185, zones: [0.6, 0.7, 0.8, 0.9] });
    engine.start(0);

    // Simulate warmup
    for (let t = 0; t < 60; t++) {
      const ts = t * 1000;
      const packet: HRPacket = {
        timestamp: ts,
        hr: 100 + t,
        rrIntervals: [],
        contactDetected: true,
      };
      engine.ingest(packet);
      group.ingest('a1', packet);
      group.ingest('a2', { ...packet, hr: packet.hr + 5 });
    }

    // Verify both systems tracked the data
    expect(engine.getState()).toBe('running');
    const stats = group.getStats();
    expect(stats.activeCount).toBe(2);
    expect(stats.avgHR).toBeGreaterThan(0);

    const leaderboard = group.getLeaderboard('hr');
    expect(leaderboard[0]!.athleteName).toBe('Bob'); // Bob has higher HR
  });
});
