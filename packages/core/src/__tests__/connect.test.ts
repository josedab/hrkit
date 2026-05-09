import { describe, expect, it } from 'vitest';
import { connectToDevice } from '../connect.js';
import { MockTransport } from '../mock-transport.js';
import { GENERIC_HR } from '../profiles/index.js';
import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID } from '../types.js';
import { BJJ_SESSION_FIXTURE, CYCLING_HR_ONLY_FIXTURE } from './fixtures/index.js';

const POLAR_H10_PROFILE: DeviceProfile = {
  brand: 'Polar',
  model: 'H10',
  namePrefix: 'Polar H10',
  capabilities: ['heartRate', 'rrIntervals', 'ecg', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

describe('connectToDevice', () => {
  it('connects to preferred device', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    const conn = await connectToDevice(transport, {
      prefer: [POLAR_H10_PROFILE],
      timeoutMs: 5000,
    });

    expect(conn.deviceId).toBe('h10-001');
    expect(conn.profile).toBe(POLAR_H10_PROFILE);
  });

  it('falls back to generic when no preferred match', async () => {
    const transport = new MockTransport(CYCLING_HR_ONLY_FIXTURE);

    const conn = await connectToDevice(transport, {
      prefer: [POLAR_H10_PROFILE],
      fallback: GENERIC_HR,
      timeoutMs: 5000,
    });

    expect(conn.deviceId).toBe('generic-001');
    expect(conn.profile).toBe(GENERIC_HR);
  });

  it('throws when no profiles specified', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    await expect(connectToDevice(transport)).rejects.toThrow('No device profiles');
  });

  it('matches device names case-insensitively', async () => {
    // The fixture device name is 'Polar H10 A1B2C3', profile prefix is 'Polar H10'
    const lowerProfile: DeviceProfile = {
      ...POLAR_H10_PROFILE,
      namePrefix: 'polar h10',
    };

    const transport = new MockTransport(BJJ_SESSION_FIXTURE);
    const conn = await connectToDevice(transport, {
      prefer: [lowerProfile],
      timeoutMs: 5000,
    });

    expect(conn.deviceId).toBe('h10-001');
  });

  it('matches with uppercase prefix against mixed-case device name', async () => {
    const upperProfile: DeviceProfile = {
      ...POLAR_H10_PROFILE,
      namePrefix: 'POLAR H10',
    };

    const transport = new MockTransport(BJJ_SESSION_FIXTURE);
    const conn = await connectToDevice(transport, {
      prefer: [upperProfile],
      timeoutMs: 5000,
    });

    expect(conn.deviceId).toBe('h10-001');
  });
});

describe('MockTransport', () => {
  it('replays fixture packets via heartRate()', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);
    const conn = await transport.connect('h10-001', POLAR_H10_PROFILE);

    const packets = [];
    for await (const packet of conn.heartRate()) {
      packets.push(packet);
    }

    expect(packets).toHaveLength(BJJ_SESSION_FIXTURE.packets.length);
    expect(packets[0]!.hr).toBe(72);
  });

  it('supports disconnect', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);
    const conn = await transport.connect('h10-001', POLAR_H10_PROFILE);

    await conn.disconnect();
    // onDisconnect should resolve
    await conn.onDisconnect;
  });

  it('throws for unknown device ID', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    await expect(transport.connect('unknown', GENERIC_HR)).rejects.toThrow('No fixture');
  });

  it('falls back to discovered device when scan stream ends', async () => {
    const fixture = {
      device: { id: 'generic-001', name: 'Generic HR', rssi: -60 },
      packets: [{ timestamp: 0, hr: 72, rrIntervals: [833], contactDetected: true }],
    };
    const transport = new MockTransport(fixture);
    const specificProfile: DeviceProfile = {
      brand: 'Specific',
      model: 'X9000',
      namePrefix: 'X9000',
      capabilities: ['heartRate'],
      serviceUUIDs: [GATT_HR_SERVICE_UUID],
    };
    const conn = await connectToDevice(transport, {
      prefer: [specificProfile],
      fallback: GENERIC_HR,
      timeoutMs: 5000,
    });
    expect(conn.deviceId).toBe('generic-001');
  });

  it('throws DeviceNotFoundError when no profiles specified', async () => {
    const transport = new MockTransport({
      device: { id: 'test', name: 'Test' },
      packets: [{ timestamp: 0, hr: 60, rrIntervals: [1000], contactDetected: true }],
    });
    await expect(connectToDevice(transport, { prefer: [] })).rejects.toThrow('No device profiles');
  });

  it('scans and yields devices', async () => {
    const transport = new MockTransport([BJJ_SESSION_FIXTURE, CYCLING_HR_ONLY_FIXTURE]);

    const devices = [];
    for await (const device of transport.scan()) {
      devices.push(device);
    }

    expect(devices).toHaveLength(2);
    expect(devices[0]!.name).toBe('Polar H10 A1B2C3');
    expect(devices[1]!.name).toBe('HR-Strap');
  });
});
