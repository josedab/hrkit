import type { BLETransport, DeviceProfile, HRConnection, HRDevice, HRPacket } from '@hrkit/core';
import { GATT_HR_MEASUREMENT_UUID, GATT_HR_SERVICE_UUID, parseHeartRate } from '@hrkit/core';

/**
 * Check if the react-native-ble-plx BleManager is likely functional.
 * Useful for preflight checks before scanning.
 *
 * @param manager The BleManager instance to check.
 * @returns true if the manager has the expected API surface.
 */
export function isBleManagerReady(manager: unknown): manager is BleManager {
  return (
    typeof manager === 'object' &&
    manager !== null &&
    typeof (manager as BleManager).startDeviceScan === 'function' &&
    typeof (manager as BleManager).connectToDevice === 'function'
  );
}
interface BleManager {
  startDeviceScan(
    uuids: string[] | null,
    options: Record<string, unknown> | null,
    callback: (error: unknown, device: ScannedDevice | null) => void,
  ): void;
  stopDeviceScan(): void;
  connectToDevice(deviceId: string): Promise<ConnectedDevice>;
}

interface ScannedDevice {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
}

interface ConnectedDevice {
  id: string;
  name: string | null;
  discoverAllServicesAndCharacteristics(): Promise<ConnectedDevice>;
  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: unknown, char: CharacteristicValue | null) => void,
  ): Subscription;
  cancelConnection(): Promise<ConnectedDevice>;
  onDisconnected(listener: (error: unknown, device: ConnectedDevice) => void): Subscription;
}

interface CharacteristicValue {
  value: string | null; // base64 encoded
}

interface Subscription {
  remove(): void;
}

function base64ToDataView(b64: string): DataView {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new DataView(bytes.buffer);
}

/**
 * BLE transport adapter for React Native using react-native-ble-plx.
 */
export class ReactNativeTransport implements BLETransport {
  private manager: BleManager;

  constructor(manager: BleManager) {
    this.manager = manager;
  }

  async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    const serviceUUIDs: string[] = [];
    if (profiles) {
      for (const profile of profiles) {
        for (const uuid of profile.serviceUUIDs) {
          if (!serviceUUIDs.includes(uuid)) {
            serviceUUIDs.push(uuid);
          }
        }
      }
    }

    const queue: HRDevice[] = [];
    let resolve: (() => void) | null = null;
    const done = false;
    const seen = new Set<string>();

    this.manager.startDeviceScan(serviceUUIDs.length > 0 ? serviceUUIDs : null, null, (error, device) => {
      if (error || !device) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);

      const name = device.name ?? device.localName ?? 'Unknown';
      const matchedProfile =
        profiles?.find((p) => p.namePrefix && name.startsWith(p.namePrefix)) ??
        profiles?.find((p) => p.namePrefix === '');

      const hrDevice: HRDevice = {
        id: device.id,
        name,
        rssi: device.rssi ?? -100,
        profile: matchedProfile,
      };

      queue.push(hrDevice);
      if (resolve) {
        resolve();
        resolve = null;
      }
    });

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }
    } finally {
      this.manager.stopDeviceScan();
    }
  }

  async stopScan(): Promise<void> {
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();

    let resolveDisconnect: () => void;
    const onDisconnect = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    const disconnectSub = device.onDisconnected(() => {
      resolveDisconnect();
    });

    const connection: HRConnection = {
      deviceId: device.id,
      deviceName: device.name ?? 'Unknown',
      profile,

      async *heartRate(): AsyncIterable<HRPacket> {
        const queue: HRPacket[] = [];
        let resolve: (() => void) | null = null;
        let done = false;

        const subscription = device.monitorCharacteristicForService(
          GATT_HR_SERVICE_UUID,
          GATT_HR_MEASUREMENT_UUID,
          (error, char) => {
            if (error || !char?.value) {
              done = true;
              if (resolve) resolve();
              return;
            }

            try {
              const dataView = base64ToDataView(char.value);
              const packet = parseHeartRate(dataView);
              queue.push(packet);
              if (resolve) {
                resolve();
                resolve = null;
              }
            } catch {
              // Skip malformed packets rather than crashing the stream
            }
          },
        );

        try {
          while (!done) {
            if (queue.length > 0) {
              yield queue.shift()!;
            } else {
              await new Promise<void>((r) => {
                resolve = r;
              });
            }
          }
          while (queue.length > 0) {
            yield queue.shift()!;
          }
        } finally {
          subscription.remove();
        }
      },

      async disconnect(): Promise<void> {
        disconnectSub.remove();
        await device.cancelConnection();
        resolveDisconnect();
      },

      onDisconnect,
    };

    return connection;
  }
}
