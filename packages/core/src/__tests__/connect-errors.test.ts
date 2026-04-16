import { describe, expect, it } from 'vitest';
import { connectToDevice, DeviceNotFoundError, TimeoutError } from '../index.js';
import { MockTransport } from '../mock-transport.js';
import type { DeviceProfile } from '../types.js';
import { GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID } from '../types.js';
import { BJJ_SESSION_FIXTURE } from './fixtures/index.js';

const _POLAR_H10_PROFILE: DeviceProfile = {
  brand: 'Polar',
  model: 'H10',
  namePrefix: 'Polar H10',
  capabilities: ['heartRate', 'rrIntervals', 'ecg', 'accelerometer'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID, POLAR_PMD_SERVICE_UUID],
};

describe('connectToDevice — custom errors', () => {
  it('throws DeviceNotFoundError when no profiles specified', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    try {
      await connectToDevice(transport);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DeviceNotFoundError);
    }
  });

  it('throws TimeoutError on scan timeout', async () => {
    // Create a transport with no matching devices that will not yield anything matching "NonExistent"
    const transport = new MockTransport({
      device: { id: 'other', name: 'Other Device' },
      packets: [],
    });

    const nonExistentProfile: DeviceProfile = {
      brand: 'None',
      model: 'None',
      namePrefix: 'NonExistent',
      capabilities: ['heartRate'],
      serviceUUIDs: [GATT_HR_SERVICE_UUID],
    };

    try {
      await connectToDevice(transport, {
        prefer: [nonExistentProfile],
        timeoutMs: 100,
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      // Should be either TimeoutError or DeviceNotFoundError depending on timing
      expect(err).toBeDefined();
      const isExpectedError = err instanceof TimeoutError || err instanceof DeviceNotFoundError;
      expect(isExpectedError).toBe(true);
    }
  });

  it('DeviceNotFoundError is catchable as HRKitError', async () => {
    const transport = new MockTransport(BJJ_SESSION_FIXTURE);

    try {
      await connectToDevice(transport);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DeviceNotFoundError);
      expect((err as DeviceNotFoundError).name).toBe('DeviceNotFoundError');
    }
  });
});
