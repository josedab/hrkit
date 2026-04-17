import { type DeviceProfile, MockTransport } from '@hrkit/core';
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
});
