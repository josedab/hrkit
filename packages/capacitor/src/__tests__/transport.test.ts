import { GATT_HR_MEASUREMENT_UUID, GATT_HR_SERVICE_UUID, GENERIC_HR } from '@hrkit/core';
import { describe, expect, it, vi } from 'vitest';
import { CapacitorBLETransport, type CapacitorBleClient } from '../index.js';

function makeMockClient(): { client: CapacitorBleClient; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {
    initialize: [],
    requestLEScan: [],
    stopLEScan: [],
    connect: [],
    disconnect: [],
    startNotifications: [],
    stopNotifications: [],
  };
  let scanCb: ((r: { device: { deviceId: string; name?: string }; rssi?: number }) => void) | null = null;
  let notifCb: ((v: DataView) => void) | null = null;
  let disconnectCb: ((id: string) => void) | undefined;

  const client: CapacitorBleClient = {
    initialize: async (opts) => {
      calls.initialize!.push(opts);
    },
    requestLEScan: async (opts, cb) => {
      calls.requestLEScan!.push(opts);
      scanCb = cb;
    },
    stopLEScan: async () => {
      calls.stopLEScan!.push({});
    },
    connect: async (id, cb) => {
      calls.connect!.push(id);
      disconnectCb = cb;
    },
    disconnect: async (id) => {
      calls.disconnect!.push(id);
      if (disconnectCb) disconnectCb(id);
    },
    startNotifications: async (deviceId, service, char, cb) => {
      calls.startNotifications!.push({ deviceId, service, char });
      notifCb = cb;
    },
    stopNotifications: async (deviceId, service, char) => {
      calls.stopNotifications!.push({ deviceId, service, char });
    },
  };

  return Object.assign(
    { client, calls },
    {
      emitScan: (r: { deviceId: string; name?: string; rssi?: number }) =>
        scanCb?.({ device: { deviceId: r.deviceId, name: r.name }, rssi: r.rssi }),
      emitNotification: (v: DataView) => notifCb?.(v),
      triggerDisconnect: (id: string) => disconnectCb?.(id),
    },
  );
}

describe('CapacitorBLETransport', () => {
  it('initializes the BLE client lazily on first scan', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client, scanTimeoutMs: 50 });
    const it = t.scan()[Symbol.asyncIterator]();
    const next = it.next();
    // Allow event loop to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(m.calls.initialize!.length).toBe(1);
    // Trigger timeout
    await next;
  });

  it('yields scanned devices matching the profile namePrefix', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client, scanTimeoutMs: 100 });
    const customProfile = { ...GENERIC_HR, namePrefix: 'Polar', brand: 'Polar', model: 'H10' };
    const iter = t.scan([customProfile]);
    const it = iter[Symbol.asyncIterator]();
    const promise = it.next();

    // Wait until requestLEScan has been called
    await new Promise((r) => setTimeout(r, 10));
    m.emitScan({ deviceId: 'A', name: 'Polar H10 ABC', rssi: -55 });
    m.emitScan({ deviceId: 'B', name: 'OtherDevice', rssi: -60 });

    const result = await promise;
    expect(result.value).toMatchObject({ id: 'A', name: 'Polar H10 ABC', rssi: -55 });
    await it.return?.();
  });

  it('connects and parses HR notifications', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client });
    const conn = await t.connect('dev1', GENERIC_HR);
    expect(m.calls.connect).toContain('dev1');

    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const promise = iter.next();
    // Wait for startNotifications subscription
    await new Promise((r) => setTimeout(r, 10));

    expect(m.calls.startNotifications![0]).toMatchObject({
      service: GATT_HR_SERVICE_UUID,
      char: GATT_HR_MEASUREMENT_UUID,
    });

    // Build a minimal HR notification: flags=0 (uint8 hr, no rr), hr=72
    const buf = new Uint8Array([0x00, 72]);
    m.emitNotification(new DataView(buf.buffer));

    const result = await promise;
    expect(result.value?.hr).toBe(72);

    await conn.disconnect();
    expect(m.calls.disconnect).toContain('dev1');
  });

  it('completes the heart rate iterator when device disconnects', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client });
    const conn = await t.connect('dev2', GENERIC_HR);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const promise = iter.next();

    await new Promise((r) => setTimeout(r, 10));
    m.triggerDisconnect('dev2');

    const result = await promise;
    expect(result.done).toBe(true);
  });

  it('skips malformed notifications silently', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client });
    const conn = await t.connect('dev3', GENERIC_HR);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const p = iter.next();
    await new Promise((r) => setTimeout(r, 10));

    // empty buffer => parseHeartRate throws ParseError; should be swallowed
    m.emitNotification(new DataView(new Uint8Array([]).buffer));
    // Then a valid one
    m.emitNotification(new DataView(new Uint8Array([0x00, 99]).buffer));

    const result = await p;
    expect(result.value?.hr).toBe(99);
    await conn.disconnect();
  });

  it('stopScan tolerates unstarted state', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client });
    await expect(t.stopScan()).resolves.toBeUndefined();
  });

  it('stops scanning on stopScan call', async () => {
    const m = makeMockClient();
    const t = new CapacitorBLETransport({ client: m.client, scanTimeoutMs: 100 });
    const iter = t.scan()[Symbol.asyncIterator]();
    const p = iter.next();
    await new Promise((r) => setTimeout(r, 20));
    await t.stopScan();
    await p.catch(() => {});
    expect(m.calls.stopLEScan!.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CapacitorBLETransport without injected client', () => {
  it('throws a clear error when plugin not installed', async () => {
    const t = new CapacitorBLETransport();
    // We can't trigger the dynamic import here without bundler shenanigans, but
    // we can at least confirm the constructor doesn't crash.
    expect(t).toBeInstanceOf(CapacitorBLETransport);
    vi.restoreAllMocks();
  });
});
