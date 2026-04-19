import { GATT_HR_MEASUREMENT_UUID, GATT_HR_SERVICE_UUID } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { createCapacitorNativeTransport, type HrkitNativePlugin } from '../index.js';

interface Listener {
  event: string;
  cb: (data: unknown) => void;
}

function makeMockPlugin(): HrkitNativePlugin & { fire: (event: string, data: unknown) => void } {
  const listeners: Listener[] = [];
  return {
    async startScan() {},
    async stopScan() {},
    async connect({ deviceId }) {
      return { deviceId, name: 'Mock Strap' };
    },
    async disconnect() {},
    async startNotifications() {},
    async stopNotifications() {},
    async addListener(event, cb) {
      const entry: Listener = { event, cb };
      listeners.push(entry);
      return {
        async remove() {
          const i = listeners.indexOf(entry);
          if (i >= 0) listeners.splice(i, 1);
        },
      };
    },
    fire(event: string, data: unknown) {
      for (const l of listeners) if (l.event === event) l.cb(data);
    },
  };
}

const HR_PROFILE = {
  id: 'generic-hr',
  brand: 'Generic',
  capabilities: ['heartRate' as const],
  services: [
    {
      uuid: GATT_HR_SERVICE_UUID,
      characteristics: [{ uuid: GATT_HR_MEASUREMENT_UUID, capability: 'heartRate' as const }],
    },
  ],
};

describe('createCapacitorNativeTransport', () => {
  it('emits scan results from native scanResult events', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const iter = transport.scan([HR_PROFILE])[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('scanResult', { deviceId: 'aa:bb', name: 'Polar H10', rssi: -50 });
    const r = await next;
    expect(r.value?.id).toBe('aa:bb');
    expect(r.value?.name).toBe('Polar H10');
    expect(r.value?.rssi).toBe(-50);
  });

  it('parses HR packets from gattNotification events', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    expect(conn.deviceName).toBe('Mock Strap');
    expect(conn.profile).toBe(HR_PROFILE);

    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      hex: '104b0004',
    });
    const r = await next;
    expect(r.value?.hr).toBe(75);
    expect(r.value?.rrIntervals?.length).toBeGreaterThan(0);
    await conn.disconnect();
  });

  it('ignores notifications for other devices and unrelated characteristics', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('gattNotification', {
      deviceId: 'cc:dd',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      hex: '104b0004',
    });
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: '0000feff-0000-1000-8000-00805f9b34fb',
      hex: '104b0004',
    });
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      hex: '00aa',
    });
    const r = await next;
    expect(r.value?.hr).toBe(0xaa);
    await conn.disconnect();
  });

  it('scan returns early when signal is already aborted', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const ac = new AbortController();
    ac.abort();
    const results: unknown[] = [];
    for await (const dev of transport.scan([HR_PROFILE], { signal: ac.signal })) {
      results.push(dev);
    }
    expect(results).toHaveLength(0);
  });

  it('scan handles missing name and rssi in scan result', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const iter = transport.scan([HR_PROFILE])[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('scanResult', { deviceId: 'xx:yy' });
    const r = await next;
    expect(r.value?.name).toBe('Unknown');
    expect(r.value?.rssi).toBe(0);
  });

  it('scan uses default service when no profiles provided', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const iter = transport.scan()[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('scanResult', { deviceId: 'zz:zz', name: 'Device' });
    const r = await next;
    expect(r.value?.id).toBe('zz:zz');
  });

  it('stopScan delegates to plugin', async () => {
    const plugin = makeMockPlugin();
    let stopped = false;
    plugin.stopScan = async () => {
      stopped = true;
    };
    const transport = await createCapacitorNativeTransport({ plugin });
    await transport.stopScan();
    expect(stopped).toBe(true);
  });

  it('scan stops on abort signal', async () => {
    const plugin = makeMockPlugin();
    let scanStopped = false;
    plugin.stopScan = async () => {
      scanStopped = true;
    };
    const transport = await createCapacitorNativeTransport({ plugin });
    const ac = new AbortController();
    const iter = transport.scan([HR_PROFILE], { signal: ac.signal })[Symbol.asyncIterator]();
    const next = iter.next();
    plugin.fire('scanResult', { deviceId: 'aa:bb', name: 'Dev' });
    await next;
    ac.abort();
    expect(scanStopped).toBe(true);
  });

  it('connect throws when signal is already aborted', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const ac = new AbortController();
    ac.abort();
    await expect(transport.connect('aa:bb', HR_PROFILE, { signal: ac.signal })).rejects.toThrow('connect aborted');
  });

  it('connectionStateChange triggers onDisconnect', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    let disconnected = false;
    conn.onDisconnect.then(() => {
      disconnected = true;
    });
    plugin.fire('connectionStateChange', { deviceId: 'aa:bb', connected: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(disconnected).toBe(true);
  });

  it('connectionStateChange for other device does not trigger disconnect', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    let disconnected = false;
    conn.onDisconnect.then(() => {
      disconnected = true;
    });
    plugin.fire('connectionStateChange', { deviceId: 'cc:dd', connected: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(disconnected).toBe(false);
    await conn.disconnect();
  });

  it('heartRate returns early when signal is already aborted', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    const ac = new AbortController();
    ac.abort();
    const results: unknown[] = [];
    for await (const pkt of conn.heartRate({ signal: ac.signal })) {
      results.push(pkt);
    }
    expect(results).toHaveLength(0);
    await conn.disconnect();
  });

  it('heartRate handles b64 format', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const next = iter.next();
    // 0x00 0x50 → flags=0, hr=80
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      b64: 'AFA=',
    });
    const r = await next;
    expect(r.value?.hr).toBe(80);
    await conn.disconnect();
  });

  it('heartRate ignores notifications without hex or b64', async () => {
    const plugin = makeMockPlugin();
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const next = iter.next();
    // No hex or b64 — should be ignored
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
    });
    // Send a valid one to unblock
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      hex: '005A',
    });
    const r = await next;
    expect(r.value?.hr).toBe(90);
    await conn.disconnect();
  });

  it('heartRate stops on abort and cleans up', async () => {
    const plugin = makeMockPlugin();
    let notifStopped = false;
    plugin.stopNotifications = async () => {
      notifStopped = true;
    };
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    const ac = new AbortController();
    const collected: unknown[] = [];
    const consuming = (async () => {
      for await (const pkt of conn.heartRate({ signal: ac.signal })) {
        collected.push(pkt);
        ac.abort();
      }
    })();
    plugin.fire('gattNotification', {
      deviceId: 'aa:bb',
      service: GATT_HR_SERVICE_UUID,
      characteristic: GATT_HR_MEASUREMENT_UUID,
      hex: '005A',
    });
    await consuming;
    expect(collected).toHaveLength(1);
    expect(notifStopped).toBe(true);
    await conn.disconnect();
  });

  it('connect with abort signal after connect disconnects', async () => {
    const plugin = makeMockPlugin();
    let disconnected = false;
    plugin.disconnect = async () => {
      disconnected = true;
    };
    const transport = await createCapacitorNativeTransport({ plugin });
    const ac = new AbortController();
    const conn = await transport.connect('aa:bb', HR_PROFILE, { signal: ac.signal });
    ac.abort();
    // Give time for abort handler
    await new Promise((r) => setTimeout(r, 10));
    expect(disconnected).toBe(true);
    // Ensure conn onDisconnect can still resolve
    conn.onDisconnect.catch(() => {});
  });

  it('uses default connection name when connect returns no name', async () => {
    const plugin = makeMockPlugin();
    plugin.connect = async ({ deviceId }) => ({ deviceId });
    const transport = await createCapacitorNativeTransport({ plugin });
    const conn = await transport.connect('aa:bb', HR_PROFILE);
    expect(conn.deviceName).toBe('Unknown');
    await conn.disconnect();
  });
});
