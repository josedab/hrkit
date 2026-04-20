export { SDK_NAME, SDK_VERSION } from './version.js';

import type { BLETransport, DeviceProfile, HRConnection, HRDevice, HRPacket } from '@hrkit/core';
import { ConnectionError, GATT_HR_MEASUREMENT_UUID, GATT_HR_SERVICE_UUID, parseHeartRate } from '@hrkit/core';

/**
 * Check if Web Bluetooth is available in the current browser.
 * Returns false in Node.js, unsupported browsers, or non-HTTPS contexts.
 */
export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.bluetooth !== 'undefined' &&
    typeof navigator.bluetooth.requestDevice === 'function'
  );
}

/**
 * BLE transport adapter for Web Bluetooth API.
 *
 * Note: Web Bluetooth uses a user-selection picker rather than continuous
 * scanning. The scan() method yields a single user-selected device and ends.
 */
export class WebBluetoothTransport implements BLETransport {
  async *scan(profiles?: DeviceProfile[], options?: { signal?: AbortSignal }): AsyncIterable<HRDevice> {
    if (options?.signal?.aborted) return;
    const onAbort = () => {
      void this.stopScan();
    };
    options?.signal?.addEventListener('abort', onAbort, { once: true });
    try {
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

      const matchedProfile =
        profiles?.find((p) => p.namePrefix && btDevice.name?.startsWith(p.namePrefix)) ??
        profiles?.find((p) => p.namePrefix === '');

      yield {
        id: btDevice.id,
        name: btDevice.name ?? 'Unknown',
        rssi: 0, // Web Bluetooth doesn't expose RSSI during requestDevice
        profile: matchedProfile,
      };
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
    }
  }

  async stopScan(): Promise<void> {
    // Web Bluetooth scan is modal — no explicit stop needed
  }

  async connect(deviceId: string, profile: DeviceProfile, options?: { signal?: AbortSignal }): Promise<HRConnection> {
    if (options?.signal?.aborted) {
      throw new ConnectionError('connect aborted');
    }
    // Re-request the device by ID — Web Bluetooth requires this
    const devices = await navigator.bluetooth.getDevices();
    const btDevice = devices.find((d) => d.id === deviceId);

    if (!btDevice) {
      throw new ConnectionError(`Device "${deviceId}" not found. Web Bluetooth requires user gesture.`);
    }

    if (options?.signal?.aborted) throw new ConnectionError('connect aborted');
    const server = await btDevice.gatt!.connect();
    if (options?.signal?.aborted) {
      server.disconnect();
      throw new ConnectionError('connect aborted');
    }
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

    // Auto-disconnect when caller's connect-signal aborts after we're connected.
    const connectAbort = () => {
      try {
        server.disconnect();
      } catch {
        /* already gone */
      }
    };
    options?.signal?.addEventListener('abort', connectAbort, { once: true });

    const connection: HRConnection = {
      deviceId,
      deviceName: btDevice.name ?? 'Unknown',
      profile,

      async *heartRate(hrOptions?: { signal?: AbortSignal }): AsyncIterable<HRPacket> {
        if (hrOptions?.signal?.aborted) return;
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
        // Treat a per-call abort as a clean stream end (no throw — same shape as disconnect).
        const onHrAbort = () => disconnectCleanup();
        hrOptions?.signal?.addEventListener('abort', onHrAbort, { once: true });

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
          // Yield remaining
          while (queue.length > 0) {
            yield queue.shift()!;
          }
        } finally {
          hrChar.removeEventListener('characteristicvaluechanged', handler);
          btDevice.removeEventListener('gattserverdisconnected', disconnectCleanup);
          hrOptions?.signal?.removeEventListener('abort', onHrAbort);
          await hrChar.stopNotifications().catch(() => {});
        }
      },

      async disconnect(): Promise<void> {
        options?.signal?.removeEventListener('abort', connectAbort);
        btDevice.removeEventListener('gattserverdisconnected', handleDisconnect);
        server.disconnect();
        resolveDisconnect();
      },

      onDisconnect,
    };

    return connection;
  }
}
