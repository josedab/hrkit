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
});
