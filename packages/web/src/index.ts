import type {
  BLETransport,
  DeviceProfile,
  HRConnection,
  HRDevice,
  HRPacket,
} from '@hrkit/core';
import { parseHeartRate, GATT_HR_SERVICE_UUID, GATT_HR_MEASUREMENT_UUID } from '@hrkit/core';

/**
 * BLE transport adapter for Web Bluetooth API.
 *
 * Note: Web Bluetooth uses a user-selection picker rather than continuous
 * scanning. The scan() method yields a single user-selected device and ends.
 */
export class WebBluetoothTransport implements BLETransport {
  async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    const filters: BluetoothLEScanFilter[] = [];
    const optionalServices: string[] = [];

    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        if (profile.namePrefix) {
          filters.push({ namePrefix: profile.namePrefix });
        }
        for (const uuid of profile.serviceUUIDs) {
          if (!optionalServices.includes(uuid)) {
            optionalServices.push(uuid);
          }
        }
      }
    }

    // If no named filters, accept any device with HR service
    if (filters.length === 0) {
      filters.push({ services: [GATT_HR_SERVICE_UUID] });
    }

    const btDevice = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices,
    });

    const matchedProfile = profiles?.find(
      (p) => p.namePrefix && btDevice.name?.startsWith(p.namePrefix),
    ) ?? profiles?.find((p) => p.namePrefix === '');

    yield {
      id: btDevice.id,
      name: btDevice.name ?? 'Unknown',
      rssi: 0, // Web Bluetooth doesn't expose RSSI during requestDevice
      profile: matchedProfile,
    };
  }

  async stopScan(): Promise<void> {
    // Web Bluetooth scan is modal — no explicit stop needed
  }

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    // Re-request the device by ID — Web Bluetooth requires this
    const devices = await navigator.bluetooth.getDevices();
    const btDevice = devices.find((d) => d.id === deviceId);

    if (!btDevice) {
      throw new Error(`Device "${deviceId}" not found. Web Bluetooth requires user gesture.`);
    }

    const server = await btDevice.gatt!.connect();
    const hrService = await server.getPrimaryService(GATT_HR_SERVICE_UUID);
    const hrChar = await hrService.getCharacteristic(GATT_HR_MEASUREMENT_UUID);

    let resolveDisconnect: () => void;
    const onDisconnect = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    const handleDisconnect = () => {
      resolveDisconnect();
    };
    btDevice.addEventListener('gattserverdisconnected', handleDisconnect);

    const connection: HRConnection = {
      deviceId,
      deviceName: btDevice.name ?? 'Unknown',
      profile,

      async *heartRate(): AsyncIterable<HRPacket> {
        await hrChar.startNotifications();

        const queue: HRPacket[] = [];
        let resolve: (() => void) | null = null;
        let done = false;

        const handler = (event: Event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          if (target.value) {
            try {
              const packet = parseHeartRate(target.value);
              queue.push(packet);
              if (resolve) {
                resolve();
                resolve = null;
              }
            } catch {
              // Skip malformed packets rather than crashing the stream
            }
          }
        };

        hrChar.addEventListener('characteristicvaluechanged', handler);
        const disconnectCleanup = () => {
          done = true;
          if (resolve) resolve();
        };
        btDevice.addEventListener('gattserverdisconnected', disconnectCleanup);

        try {
          while (!done) {
            if (queue.length > 0) {
              yield queue.shift()!;
            } else {
              await new Promise<void>((r) => { resolve = r; });
            }
          }
          // Yield remaining
          while (queue.length > 0) {
            yield queue.shift()!;
          }
        } finally {
          hrChar.removeEventListener('characteristicvaluechanged', handler);
          btDevice.removeEventListener('gattserverdisconnected', disconnectCleanup);
          await hrChar.stopNotifications().catch(() => {});
        }
      },

      async disconnect(): Promise<void> {
        btDevice.removeEventListener('gattserverdisconnected', handleDisconnect);
        server.disconnect();
        resolveDisconnect();
      },

      onDisconnect,
    };

    return connection;
  }
}
