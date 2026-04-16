import { describe, it, expect } from 'vitest';
import { connectWithReconnect } from '../connection.js';
import { ConnectionError } from '../errors.js';
import { MockTransport } from '../mock-transport.js';
import { GENERIC_HR } from '../profiles/index.js';
import { HIGH_INTENSITY_FIXTURE } from './fixtures/index.js';
import type { BLETransport, DeviceProfile, HRConnection, HRDevice } from '../types.js';

describe('connectWithReconnect', () => {
  it('connects successfully on first attempt', async () => {
    const transport = new MockTransport(HIGH_INTENSITY_FIXTURE);
    const managed = await connectWithReconnect(transport, 'h10-001', GENERIC_HR);

    expect(managed.state).toBe('connected');
    expect(managed.connection).not.toBeNull();
    expect(managed.connection!.deviceId).toBe('h10-001');

    await managed.disconnect();
    expect(managed.state).toBe('disconnected');
  });

  it('emits state changes via state$', async () => {
    const transport = new MockTransport(HIGH_INTENSITY_FIXTURE);
    const states: string[] = [];

    const managed = await connectWithReconnect(transport, 'h10-001', GENERIC_HR);
    managed.state$.subscribe((s) => states.push(s));

    await managed.disconnect();

    expect(states).toContain('connected');
    expect(states).toContain('disconnected');
  });

  it('retries on failure and eventually connects', async () => {
    let attempts = 0;
    const transport: BLETransport = {
      async *scan(): AsyncIterable<HRDevice> { yield { id: 'dev', name: 'Dev', rssi: -50 }; },
      async stopScan() {},
      async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
        attempts++;
        if (attempts < 3) throw new Error('Connection failed');
        return new MockTransport(HIGH_INTENSITY_FIXTURE).connect('h10-001', profile);
      },
    };

    const managed = await connectWithReconnect(transport, 'dev', GENERIC_HR, {
      maxAttempts: 5,
      initialDelayMs: 10,
    });

    expect(managed.state).toBe('connected');
    expect(attempts).toBe(3);
    await managed.disconnect();
  });

  it('throws ConnectionError after max attempts exhausted', async () => {
    const transport: BLETransport = {
      async *scan(): AsyncIterable<HRDevice> { yield { id: 'dev', name: 'Dev', rssi: -50 }; },
      async stopScan() {},
      async connect(): Promise<HRConnection> { throw new Error('Always fails'); },
    };

    await expect(
      connectWithReconnect(transport, 'dev', GENERIC_HR, {
        maxAttempts: 2,
        initialDelayMs: 10,
      }),
    ).rejects.toThrow(ConnectionError);
  });

  it('applies exponential backoff between retries', async () => {
    const timestamps: number[] = [];
    const transport: BLETransport = {
      async *scan(): AsyncIterable<HRDevice> { yield { id: 'dev', name: 'Dev', rssi: -50 }; },
      async stopScan() {},
      async connect(): Promise<HRConnection> {
        timestamps.push(Date.now());
        throw new Error('fail');
      },
    };

    try {
      await connectWithReconnect(transport, 'dev', GENERIC_HR, {
        maxAttempts: 3,
        initialDelayMs: 50,
        backoffMultiplier: 2,
      });
    } catch { /* expected */ }

    expect(timestamps).toHaveLength(3);
    // Second gap should be roughly 2x the first (backoff)
    if (timestamps.length >= 3) {
      const gap1 = timestamps[1]! - timestamps[0]!;
      const gap2 = timestamps[2]! - timestamps[1]!;
      expect(gap2).toBeGreaterThanOrEqual(gap1 * 1.5); // Allow some timing slack
    }
  });

  it('disconnect stops reconnection', async () => {
    const transport = new MockTransport(HIGH_INTENSITY_FIXTURE);
    const managed = await connectWithReconnect(transport, 'h10-001', GENERIC_HR);

    await managed.disconnect();
    expect(managed.state).toBe('disconnected');
    expect(managed.connection).toBeNull();
  });
});
