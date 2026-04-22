import { describe, expect, it } from 'vitest';
import type { FusedHRPacket } from '../multi-device.js';
import { MultiDeviceManager } from '../multi-device.js';
import type { DeviceProfile, HRConnection, HRPacket } from '../types.js';

// ── Helpers ─────────────────────────────────────────────────────────────

const GENERIC_PROFILE: DeviceProfile = {
  brand: 'Test',
  model: 'Mock',
  namePrefix: 'Mock',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: ['0000180d-0000-1000-8000-00805f9b34fb'],
};

function makePacket(hr: number, timestamp: number, rr: number[] = []): HRPacket {
  return { hr, timestamp, rrIntervals: rr, contactDetected: true };
}

class MockConnection implements HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;
  private packets: HRPacket[];
  private disconnectResolve!: () => void;
  readonly onDisconnect: Promise<void>;
  private _disconnected = false;

  constructor(id: string, name: string, packets: HRPacket[]) {
    this.deviceId = id;
    this.deviceName = name;
    this.profile = GENERIC_PROFILE;
    this.packets = packets;
    this.onDisconnect = new Promise<void>((resolve) => {
      this.disconnectResolve = resolve;
    });
  }

  async *heartRate(): AsyncIterableIterator<HRPacket> {
    for (const pkt of this.packets) {
      if (this._disconnected) return;
      yield pkt;
    }
  }

  async disconnect(): Promise<void> {
    this._disconnected = true;
    this.disconnectResolve();
  }
}

/** Wait for a stream to emit at least `count` values, with timeout. */
function collectFused(manager: MultiDeviceManager, count: number, timeoutMs = 2000): Promise<FusedHRPacket[]> {
  return new Promise<FusedHRPacket[]>((resolve, _reject) => {
    const collected: FusedHRPacket[] = [];
    const timer = setTimeout(() => resolve(collected), timeoutMs);
    const unsub = manager.fused$.subscribe((pkt) => {
      collected.push(pkt);
      if (collected.length >= count) {
        clearTimeout(timer);
        unsub();
        resolve(collected);
      }
    });
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('MultiDeviceManager', () => {
  it('creates with default config', () => {
    const manager = new MultiDeviceManager();
    expect(manager.connectionCount).toBe(0);
    expect(manager.getQuality()).toEqual([]);
  });

  it('creates with custom config', () => {
    const manager = new MultiDeviceManager({
      strategy: 'consensus',
      primaryDeviceId: 'dev-1',
      staleThresholdMs: 5000,
    });
    expect(manager.connectionCount).toBe(0);
  });

  it('addConnection adds a device and emits fused packets', async () => {
    const manager = new MultiDeviceManager();
    const packets = [makePacket(72, 1000, [830]), makePacket(75, 2000, [800]), makePacket(78, 3000, [770])];
    const conn = new MockConnection('dev-1', 'Device 1', packets);

    const fusedPromise = collectFused(manager, 3);
    manager.addConnection(conn);

    const fused = await fusedPromise;
    expect(fused.length).toBe(3);
    expect(fused[0]!.hr).toBe(72);
    expect(fused[0]!.sourceDeviceIds).toContain('dev-1');
    expect(fused[0]!.fusionStrategy).toBe('primary-fallback');
  });

  it('primary-fallback: uses primary device', async () => {
    const manager = new MultiDeviceManager({
      strategy: 'primary-fallback',
      primaryDeviceId: 'dev-1',
      staleThresholdMs: 5000,
    });

    const pkts1 = [makePacket(72, 1000, [830])];
    const pkts2 = [makePacket(90, 1000, [667])];
    const conn1 = new MockConnection('dev-1', 'Primary', pkts1);
    const conn2 = new MockConnection('dev-2', 'Secondary', pkts2);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn1);
    manager.addConnection(conn2);

    const fused = await fusedPromise;
    // First emitted packet should be from primary
    const fromPrimary = fused.find((f) => f.sourceDeviceIds.includes('dev-1'));
    expect(fromPrimary).toBeDefined();
    expect(fromPrimary!.hr).toBe(72);
  });

  it('primary-fallback: falls back when primary is stale', async () => {
    const manager = new MultiDeviceManager({
      strategy: 'primary-fallback',
      primaryDeviceId: 'dev-1',
      staleThresholdMs: 2000,
    });

    // Primary has old packet, secondary has fresh
    const pkts1 = [makePacket(72, 1000, [830])];
    const pkts2 = [makePacket(90, 5000, [667])]; // 4s later
    const conn1 = new MockConnection('dev-1', 'Primary', pkts1);
    const conn2 = new MockConnection('dev-2', 'Secondary', pkts2);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn1);
    manager.addConnection(conn2);

    const fused = await fusedPromise;
    // The second fused packet (from dev-2 at t=5000) should fall back since
    // dev-1's packet at t=1000 is >2s old relative to t=5000
    const lastFused = fused[fused.length - 1]!;
    expect(lastFused.sourceDeviceIds).toContain('dev-2');
    expect(lastFused.hr).toBe(90);
  });

  it('consensus: uses median HR from multiple devices', async () => {
    const manager = new MultiDeviceManager({
      strategy: 'consensus',
      staleThresholdMs: 5000,
    });

    // Three devices emit at the same time with different HR values
    const conn1 = new MockConnection('d1', 'D1', [makePacket(60, 1000, [1000])]);
    const conn2 = new MockConnection('d2', 'D2', [makePacket(80, 1000, [750])]);
    const conn3 = new MockConnection('d3', 'D3', [makePacket(100, 1000, [600])]);

    const fusedPromise = collectFused(manager, 3);
    manager.addConnection(conn1);
    manager.addConnection(conn2);
    manager.addConnection(conn3);

    const fused = await fusedPromise;
    // With 3 devices, last fusion sees HR values [60, 80, 100], median = 80
    const lastFused = fused[fused.length - 1]!;
    expect(lastFused.hr).toBe(80);
    expect(lastFused.fusionStrategy).toBe('consensus');
    expect(lastFused.sourceDeviceIds.length).toBe(3);
  });

  it('best-rr: selects device with lowest artifact rate', async () => {
    const manager = new MultiDeviceManager({
      strategy: 'best-rr',
      staleThresholdMs: 5000,
    });

    // Device 1: clean RR intervals
    const cleanRR = [800, 810, 790, 805, 815];
    const pkts1 = cleanRR.map((rr, i) => makePacket(75, 1000 + i * 1000, [rr]));

    // Device 2: noisy RR intervals (artifacts)
    const noisyRR = [800, 1500, 400, 1200, 300];
    const pkts2 = noisyRR.map((rr, i) => makePacket(85, 1000 + i * 1000, [rr]));

    const conn1 = new MockConnection('clean', 'Clean Device', pkts1);
    const conn2 = new MockConnection('noisy', 'Noisy Device', pkts2);

    const fusedPromise = collectFused(manager, 8);
    manager.addConnection(conn1);
    manager.addConnection(conn2);

    const fused = await fusedPromise;
    // Later fused packets should prefer clean device once enough RR data
    const lastFused = fused[fused.length - 1]!;
    expect(lastFused.fusionStrategy).toBe('best-rr');
    expect(lastFused.sourceDeviceIds).toContain('clean');
  });

  it('removeConnection removes device', async () => {
    const manager = new MultiDeviceManager();
    const conn = new MockConnection('dev-1', 'D1', [makePacket(72, 1000)]);

    const fusedPromise = collectFused(manager, 1);
    manager.addConnection(conn);
    await fusedPromise;

    expect(manager.connectionCount).toBe(1);
    manager.removeConnection('dev-1');
    expect(manager.connectionCount).toBe(0);
  });

  it('getQuality returns quality metrics', async () => {
    const manager = new MultiDeviceManager();
    const packets = [makePacket(72, 1000, [830]), makePacket(75, 2000, [800])];
    const conn = new MockConnection('dev-1', 'Device 1', packets);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn);
    await fusedPromise;

    const quality = manager.getQuality();
    expect(quality.length).toBe(1);
    expect(quality[0]!.deviceId).toBe('dev-1');
    expect(quality[0]!.deviceName).toBe('Device 1');
    expect(quality[0]!.packetCount).toBe(2);
  });

  it('getDeviceQuality returns quality for specific device', async () => {
    const manager = new MultiDeviceManager();
    const conn = new MockConnection('dev-1', 'D1', [makePacket(72, 1000, [830])]);

    const fusedPromise = collectFused(manager, 1);
    manager.addConnection(conn);
    await fusedPromise;

    const q = manager.getDeviceQuality('dev-1');
    expect(q).toBeDefined();
    expect(q!.deviceId).toBe('dev-1');

    expect(manager.getDeviceQuality('nonexistent')).toBeUndefined();
  });

  it('quality score calculation is correct', async () => {
    const manager = new MultiDeviceManager({ staleThresholdMs: 3000 });
    const packets = [makePacket(72, Date.now() - 500, [830]), makePacket(75, Date.now(), [800])];
    const conn = new MockConnection('dev-1', 'D1', packets);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn);
    await fusedPromise;

    const q = manager.getDeviceQuality('dev-1');
    expect(q).toBeDefined();
    // Recent packets, clean RR, no drops → high quality
    expect(q!.qualityScore).toBeGreaterThan(0);
    expect(q!.qualityScore).toBeLessThanOrEqual(1);
    expect(q!.dropCount).toBe(0);
  });

  it('detects drops when gap > 2s', async () => {
    const manager = new MultiDeviceManager();
    const packets = [
      makePacket(72, 1000, [830]),
      makePacket(75, 5000, [800]), // 4s gap → drop
    ];
    const conn = new MockConnection('dev-1', 'D1', packets);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn);
    await fusedPromise;

    const q = manager.getDeviceQuality('dev-1');
    expect(q).toBeDefined();
    expect(q!.dropCount).toBe(1);
  });

  it('stop() disconnects all devices', async () => {
    const manager = new MultiDeviceManager();
    const conn1 = new MockConnection('d1', 'D1', [makePacket(72, 1000)]);
    const conn2 = new MockConnection('d2', 'D2', [makePacket(75, 1000)]);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn1);
    manager.addConnection(conn2);
    await fusedPromise;

    await manager.stop();
    expect(manager.connectionCount).toBe(0);
  });

  it('handles single device (degenerate case)', async () => {
    for (const strategy of ['primary-fallback', 'consensus', 'best-rr'] as const) {
      const manager = new MultiDeviceManager({ strategy });
      const conn = new MockConnection('solo', 'Solo', [makePacket(72, 1000, [830])]);

      const fusedPromise = collectFused(manager, 1);
      manager.addConnection(conn);

      const fused = await fusedPromise;
      expect(fused.length).toBe(1);
      expect(fused[0]!.hr).toBe(72);
      expect(fused[0]!.fusionStrategy).toBe(strategy);

      await manager.stop();
    }
  });

  it('throws when adding duplicate device', async () => {
    const manager = new MultiDeviceManager();
    const conn1 = new MockConnection('dev-1', 'D1', [makePacket(72, 1000)]);
    const conn2 = new MockConnection('dev-1', 'D1', [makePacket(75, 2000)]);

    manager.addConnection(conn1);
    expect(() => manager.addConnection(conn2)).toThrow('already connected');

    await manager.stop();
  });

  it('throws when adding connection after stop', async () => {
    const manager = new MultiDeviceManager();
    await manager.stop();

    const conn = new MockConnection('dev-1', 'D1', [makePacket(72, 1000)]);
    expect(() => manager.addConnection(conn)).toThrow('stopped');
  });

  describe('edge cases', () => {
    it('getQuality returns empty array when no devices', () => {
      const manager = new MultiDeviceManager();
      expect(manager.getQuality()).toEqual([]);
    });

    it('getDeviceQuality returns undefined for unknown device', () => {
      const manager = new MultiDeviceManager();
      expect(manager.getDeviceQuality('unknown')).toBeUndefined();
    });

    it('connectionCount returns 0 initially', () => {
      const manager = new MultiDeviceManager();
      expect(manager.connectionCount).toBe(0);
    });

    it('removeConnection for unknown device is no-op', () => {
      const manager = new MultiDeviceManager();
      manager.removeConnection('unknown'); // should not throw
      expect(manager.connectionCount).toBe(0);
    });
  });

  it('consensus with two devices uses average for even count', async () => {
    const manager = new MultiDeviceManager({
      strategy: 'consensus',
      staleThresholdMs: 5000,
    });

    const conn1 = new MockConnection('d1', 'D1', [makePacket(60, 1000, [1000])]);
    const conn2 = new MockConnection('d2', 'D2', [makePacket(80, 1000, [750])]);

    const fusedPromise = collectFused(manager, 2);
    manager.addConnection(conn1);
    manager.addConnection(conn2);

    const fused = await fusedPromise;
    const lastFused = fused[fused.length - 1]!;
    // Median of [60, 80] = average = 70
    expect(lastFused.hr).toBe(70);

    await manager.stop();
  });
});

describe('MultiDeviceManager validation', () => {
  it('rejects zero staleThresholdMs', () => {
    expect(() => new MultiDeviceManager({ staleThresholdMs: 0 })).toThrow(RangeError);
  });

  it('rejects negative staleThresholdMs', () => {
    expect(() => new MultiDeviceManager({ staleThresholdMs: -1000 })).toThrow(RangeError);
  });

  it('rejects NaN staleThresholdMs', () => {
    expect(() => new MultiDeviceManager({ staleThresholdMs: NaN })).toThrow(RangeError);
  });

  it('accepts valid positive staleThresholdMs', () => {
    expect(() => new MultiDeviceManager({ staleThresholdMs: 5000 })).not.toThrow();
  });
});
