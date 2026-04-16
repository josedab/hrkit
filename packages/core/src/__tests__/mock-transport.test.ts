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
});
