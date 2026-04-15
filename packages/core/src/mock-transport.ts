import type {
  BLETransport,
  DeviceProfile,
  HRConnection,
  HRDevice,
  HRPacket,
} from './types.js';

export interface MockFixture {
  device: {
    id: string;
    name: string;
    rssi?: number;
  };
  packets: HRPacket[];
}

/**
 * A mock BLE transport that replays in-memory fixture data for testing.
 * Accepts pre-built fixture objects — no file system dependency.
 */
export class MockTransport implements BLETransport {
  private fixtures: MockFixture[];
  private scanning = false;

  constructor(fixtures: MockFixture | MockFixture[]) {
    this.fixtures = Array.isArray(fixtures) ? fixtures : [fixtures];
  }

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
            if (
              profile.namePrefix === '' ||
              device.name.startsWith(profile.namePrefix)
            ) {
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

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    const fixture = this.fixtures.find((f) => f.device.id === deviceId);
    if (!fixture) {
      throw new Error(`MockTransport: No fixture for device "${deviceId}"`);
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
        try {
          for (const packet of fixture.packets) {
            if (disconnected) return;
            yield packet;
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
