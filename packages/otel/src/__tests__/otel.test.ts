import { type BLETransport, type DeviceProfile, type HRConnection, MockTransport } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { MemoryHooks, NOOP_HOOKS, recordHrSample, wrapTransport } from '../index.js';

const profile: DeviceProfile = {
  brand: 'Mock',
  model: 'MockBand',
  namePrefix: 'Mock',
  capabilities: ['heartRate'],
  serviceUUIDs: ['0000180d-0000-1000-8000-00805f9b34fb'],
};

describe('MemoryHooks', () => {
  it('records span start + end with status and duration', () => {
    const h = new MemoryHooks();
    const ctx = h.onSpanStart('test', { foo: 'bar' });
    h.onSpanEnd(ctx, 'ok');
    expect(h.spans).toHaveLength(1);
    expect(h.spans[0]?.status).toBe('ok');
    expect(h.spans[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
  it('records metrics', () => {
    const h = new MemoryHooks();
    recordHrSample(h, 142, { athleteId: 'a1' });
    expect(h.metrics).toEqual([{ name: 'hrkit.hr.bpm', kind: 'gauge', value: 142, attrs: { athleteId: 'a1' } }]);
  });
});

describe('NOOP_HOOKS', () => {
  it('does not throw and returns sane span ctx', () => {
    const ctx = NOOP_HOOKS.onSpanStart('x');
    expect(ctx.spanId).toBe('noop');
    NOOP_HOOKS.onSpanEnd(ctx, 'ok');
    NOOP_HOOKS.onMetric('m', 'counter', 1);
  });
});

describe('wrapTransport', () => {
  it('wraps connect with a span and pipes HR samples to a gauge', async () => {
    const inner = new MockTransport({
      device: { id: 'd1', name: 'Mock' },
      packets: [
        { hr: 120, timestamp: 0, rrIntervals: [], contactDetected: true },
        { hr: 125, timestamp: 1000, rrIntervals: [800], contactDetected: true },
      ],
    });
    const hooks = new MemoryHooks();
    const wrapped = wrapTransport(inner, hooks);
    const conn = await wrapped.connect('d1', profile);
    const seen: number[] = [];
    for await (const pkt of conn.heartRate()) {
      seen.push(pkt.hr);
    }
    await conn.disconnect();
    expect(seen).toEqual([120, 125]);
    const hrMetrics = hooks.metrics.filter((m) => m.name === 'hrkit.hr.bpm');
    expect(hrMetrics.map((m) => m.value)).toEqual([120, 125]);
    const rrMetrics = hooks.metrics.filter((m) => m.name === 'hrkit.rr.ms');
    expect(rrMetrics.map((m) => m.value)).toEqual([800]);
    const spans = hooks.spans.map((s) => s.name);
    expect(spans).toContain('hrkit.ble.connect');
    expect(spans).toContain('hrkit.ble.disconnect');
  });

  it('connect error records span with error status and re-throws', async () => {
    const failTransport: BLETransport = {
      scan(): AsyncIterable<never> {
        return (async function* () {
          /* empty */
        })();
      },
      async stopScan() {
        /* noop */
      },
      async connect(): Promise<never> {
        throw new Error('BLE connect failed');
      },
    };
    const hooks = new MemoryHooks();
    const wrapped = wrapTransport(failTransport, hooks);
    await expect(wrapped.connect('d1', profile)).rejects.toThrow('BLE connect failed');
    const connectSpan = hooks.spans.find((s) => s.name === 'hrkit.ble.connect');
    expect(connectSpan).toBeDefined();
    expect(connectSpan!.status).toBe('error');
  });

  it('scan error records span with error status and re-throws', async () => {
    const failTransport: BLETransport = {
      scan(): AsyncIterable<never> {
        return {
          [Symbol.asyncIterator]() {
            return {
              async next(): Promise<IteratorResult<never>> {
                throw new Error('scan failed');
              },
            };
          },
        };
      },
      async stopScan() {
        /* noop */
      },
      async connect(): Promise<HRConnection> {
        throw new Error('not implemented');
      },
    };
    const hooks = new MemoryHooks();
    const wrapped = wrapTransport(failTransport, hooks);
    await expect(async () => {
      for await (const _ of wrapped.scan()) {
        /* consume */
      }
    }).rejects.toThrow('scan failed');
    const scanSpan = hooks.spans.find((s) => s.name === 'hrkit.ble.scan');
    expect(scanSpan).toBeDefined();
    expect(scanSpan!.status).toBe('error');
  });

  it('scan success records device count metric and ok span', async () => {
    const inner = new MockTransport({
      device: { id: 'd1', name: 'Mock' },
      packets: [],
    });
    const hooks = new MemoryHooks();
    const wrapped = wrapTransport(inner, hooks);
    const devices = [];
    for await (const d of wrapped.scan()) {
      devices.push(d);
    }
    expect(devices).toHaveLength(1);
    const scanSpan = hooks.spans.find((s) => s.name === 'hrkit.ble.scan');
    expect(scanSpan).toBeDefined();
    expect(scanSpan!.status).toBe('ok');
    const countMetric = hooks.metrics.find((m) => m.name === 'hrkit.ble.scan.devices');
    expect(countMetric).toBeDefined();
    expect(countMetric!.value).toBe(1);
  });

  it('disconnect error records span with error status and re-throws', async () => {
    const failingConn: HRConnection = {
      deviceId: 'd1',
      deviceName: 'Mock',
      profile,
      heartRate(): AsyncIterable<never> {
        return (async function* () {
          /* no packets */
        })();
      },
      async disconnect(): Promise<never> {
        throw new Error('disconnect failed');
      },
      onDisconnect: new Promise(() => {}),
    };
    const mockTransport: BLETransport = {
      scan(): AsyncIterable<never> {
        return (async function* () {
          /* empty */
        })();
      },
      async stopScan() {
        /* noop */
      },
      async connect() {
        return failingConn;
      },
    };
    const hooks = new MemoryHooks();
    const wrapped = wrapTransport(mockTransport, hooks);
    const conn = await wrapped.connect('d1', profile);
    await expect(conn.disconnect()).rejects.toThrow('disconnect failed');
    const disconnSpan = hooks.spans.find((s) => s.name === 'hrkit.ble.disconnect');
    expect(disconnSpan).toBeDefined();
    expect(disconnSpan!.status).toBe('error');
  });

  it('uses NOOP_HOOKS when no hooks provided', async () => {
    const inner = new MockTransport({
      device: { id: 'd1', name: 'Mock' },
      packets: [{ hr: 100, timestamp: 0, rrIntervals: [], contactDetected: true }],
    });
    const wrapped = wrapTransport(inner);
    const conn = await wrapped.connect('d1', profile);
    const seen: number[] = [];
    for await (const pkt of conn.heartRate()) {
      seen.push(pkt.hr);
    }
    await conn.disconnect();
    expect(seen).toEqual([100]);
  });

  it('stopScan delegates to inner transport', async () => {
    let stopCalled = false;
    const inner: BLETransport = {
      scan(): AsyncIterable<never> {
        return (async function* () {
          /* empty */
        })();
      },
      async stopScan() {
        stopCalled = true;
      },
      async connect(): Promise<HRConnection> {
        throw new Error('not implemented');
      },
    };
    const wrapped = wrapTransport(inner, new MemoryHooks());
    await wrapped.stopScan();
    expect(stopCalled).toBe(true);
  });
});
