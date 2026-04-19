import { describe, expect, it } from 'vitest';
import type { MockFixture } from '../mock-transport.js';
import { MockTransport } from '../mock-transport.js';
import { GENERIC_HR } from '../profiles/index.js';
import type { HRPacket } from '../types.js';

describe('MockTransport error/disconnect simulation', () => {
  it('simulates error during streaming', async () => {
    const fixture: MockFixture = {
      device: { id: 'd1', name: 'Test' },
      packets: [{ timestamp: 0, hr: 80, rrIntervals: [], contactDetected: true }],
      error: new Error('BLE disconnect'),
    };
    const transport = new MockTransport(fixture);
    const conn = await transport.connect('d1', GENERIC_HR);
    const packets: HRPacket[] = [];
    await expect(async () => {
      for await (const p of conn.heartRate()) {
        packets.push(p);
      }
    }).rejects.toThrow('BLE disconnect');
    expect(packets).toHaveLength(1);
  });

  it('simulates disconnect after N packets', async () => {
    const fixture: MockFixture = {
      device: { id: 'd1', name: 'Test' },
      packets: [
        { timestamp: 0, hr: 80, rrIntervals: [], contactDetected: true },
        { timestamp: 1000, hr: 85, rrIntervals: [], contactDetected: true },
        { timestamp: 2000, hr: 90, rrIntervals: [], contactDetected: true },
      ],
      disconnectAfter: 2,
    };
    const transport = new MockTransport(fixture);
    const conn = await transport.connect('d1', GENERIC_HR);
    const packets: HRPacket[] = [];
    for await (const p of conn.heartRate()) {
      packets.push(p);
    }
    expect(packets).toHaveLength(2);
  });

  it('works normally without error/disconnect options', async () => {
    const fixture: MockFixture = {
      device: { id: 'd1', name: 'Test' },
      packets: [
        { timestamp: 0, hr: 80, rrIntervals: [], contactDetected: true },
        { timestamp: 1000, hr: 85, rrIntervals: [], contactDetected: true },
      ],
    };
    const transport = new MockTransport(fixture);
    const conn = await transport.connect('d1', GENERIC_HR);
    const packets: HRPacket[] = [];
    for await (const p of conn.heartRate()) {
      packets.push(p);
    }
    expect(packets).toHaveLength(2);
  });

  it('honors AbortSignal during scan', async () => {
    const fixtures: MockFixture[] = [
      { device: { id: 'd1', name: 'A' }, packets: [] },
      { device: { id: 'd2', name: 'B' }, packets: [] },
      { device: { id: 'd3', name: 'C' }, packets: [] },
    ];
    const transport = new MockTransport(fixtures);
    const ac = new AbortController();
    const seen: string[] = [];
    for await (const dev of transport.scan(undefined, { signal: ac.signal })) {
      seen.push(dev.id);
      ac.abort();
    }
    expect(seen).toEqual(['d1']);
  });

  it('returns immediately when signal is already aborted', async () => {
    const fixtures: MockFixture[] = [{ device: { id: 'd1', name: 'A' }, packets: [] }];
    const transport = new MockTransport(fixtures);
    const ac = new AbortController();
    ac.abort();
    const seen: string[] = [];
    for await (const dev of transport.scan(undefined, { signal: ac.signal })) {
      seen.push(dev.id);
    }
    expect(seen).toHaveLength(0);
  });

  it('connect() rejects when signal already aborted', async () => {
    const transport = new MockTransport({
      device: { id: 'd1', name: 'A' },
      packets: [],
    });
    const ac = new AbortController();
    ac.abort();
    await expect(transport.connect('d1', GENERIC_HR, { signal: ac.signal })).rejects.toThrow(/aborted/i);
  });

  it('heartRate() ends cleanly when signal aborts mid-stream', async () => {
    const transport = new MockTransport({
      device: { id: 'd1', name: 'A' },
      packets: Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        hr: 80 + i,
        rrIntervals: [],
        contactDetected: true,
      })),
    });
    const conn = await transport.connect('d1', GENERIC_HR);
    const ac = new AbortController();
    const seen: HRPacket[] = [];
    for await (const p of conn.heartRate({ signal: ac.signal })) {
      seen.push(p);
      if (seen.length === 3) ac.abort();
    }
    expect(seen).toHaveLength(3);
  });
});
