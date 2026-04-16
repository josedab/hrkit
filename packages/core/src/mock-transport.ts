import { DeviceNotFoundError } from './errors.js';
import type { BLETransport, DeviceProfile, HRConnection, HRDevice, HRPacket } from './types.js';

/** Mock fixture for simulating BLE device data. */
export interface MockFixture {
  /** Simulated device identity. */
  device: {
    id: string;
    name: string;
    rssi?: number;
  };
  /** Heart rate packets to replay. */
  packets: HRPacket[];
  /** If set, the heartRate() stream throws this error after all packets. */
  error?: Error;
  /** If set, simulate disconnect after this many packets. */
  disconnectAfter?: number;
}

/**
 * A mock BLE transport that replays in-memory fixture data for testing.
 * Accepts pre-built fixture objects — no file system dependency.
 */
export class MockTransport implements BLETransport {
  private fixtures: MockFixture[];
  private scanning = false;

  /** @param fixtures - One or more mock fixtures to simulate. */
  constructor(fixtures: MockFixture | MockFixture[]) {
    this.fixtures = Array.isArray(fixtures) ? fixtures : [fixtures];
  }

  /** @param profiles - Optional device profiles to filter by. */
  async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    this.scanning = true;
    try {
      for (const fixture of this.fixtures) {
        if (!this.scanning) return;

        const device: HRDevice = {
          id: fixture.device.id,
          name: fixture.device.name,
          rssi: fixture.device.rssi ?? -50,
        };

        if (profiles && profiles.length > 0) {
          for (const profile of profiles) {
            if (profile.namePrefix === '' || device.name.startsWith(profile.namePrefix)) {
              device.profile = profile;
              break;
            }
          }
        }

        yield device;
      }
    } finally {
      this.scanning = false;
    }
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
  }

  /**
   * @param deviceId - Device ID to connect to.
   * @param profile - Device profile.
   * @returns Mock HR connection.
   * @throws DeviceNotFoundError if no fixture matches.
   */
  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    const fixture = this.fixtures.find((f) => f.device.id === deviceId);
    if (!fixture) {
      throw new DeviceNotFoundError(`MockTransport: No fixture for device "${deviceId}"`);
    }

    let disconnected = false;
    let resolveDisconnect: () => void;
    const onDisconnect = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    const connection: HRConnection = {
      deviceId,
      deviceName: fixture.device.name,
      profile,

      async *heartRate(): AsyncIterable<HRPacket> {
        let count = 0;
        try {
          for (const packet of fixture.packets) {
            if (disconnected) return;
            if (fixture.disconnectAfter !== undefined && count >= fixture.disconnectAfter) {
              resolveDisconnect();
              return;
            }
            yield packet;
            count++;
          }
          if (fixture.error) {
            throw fixture.error;
          }
        } finally {
          // Stream completed
        }
      },

      async disconnect(): Promise<void> {
        disconnected = true;
        resolveDisconnect();
      },

      onDisconnect,
    };

    return connection;
  }
}
