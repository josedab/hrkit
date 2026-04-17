import {
  type BLETransport,
  type DeviceProfile,
  GATT_HR_MEASUREMENT_UUID,
  GATT_HR_SERVICE_UUID,
  type HRConnection,
  type HRDevice,
  type HRPacket,
  parseHeartRate,
} from '@hrkit/core';

/**
 * Subset of `@capacitor-community/bluetooth-le` BleClient that we depend on.
 * Defining the interface explicitly keeps the package zero-import on any
 * platform where the plugin isn't available, and makes mocking trivial in tests.
 */
export interface CapacitorBleClient {
  initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>;
  requestLEScan(
    options: { services?: string[]; namePrefix?: string; allowDuplicates?: boolean },
    callback: (result: { device: { deviceId: string; name?: string }; rssi?: number }) => void,
  ): Promise<void>;
  stopLEScan(): Promise<void>;
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  startNotifications(
    deviceId: string,
    service: string,
    characteristic: string,
    callback: (value: DataView) => void,
  ): Promise<void>;
  stopNotifications(deviceId: string, service: string, characteristic: string): Promise<void>;
}

/**
 * Lazily import `@capacitor-community/bluetooth-le` to avoid breaking
 * environments (Node, web bundlers) where the plugin isn't installed.
 */
async function loadBleClient(): Promise<CapacitorBleClient> {
  const mod = (await import(/* @vite-ignore */ '@capacitor-community/bluetooth-le')) as {
    BleClient: CapacitorBleClient;
  };
  return mod.BleClient;
}

export interface CapacitorBLETransportOptions {
  /** Override for tests / custom BLE clients (e.g., desktop Capacitor). */
  client?: CapacitorBleClient;
  /** Whether to skip Android coarse-location permission. Default: true (we don't need GPS). */
  androidNeverForLocation?: boolean;
  /** Scan duration in ms when no devices match. Default: 10000. */
  scanTimeoutMs?: number;
}

/**
 * BLE transport adapter for Capacitor (iOS + Android).
 * Wraps `@capacitor-community/bluetooth-le` with the @hrkit `BLETransport` API.
 *
 * Usage:
 * ```ts
 * import { CapacitorBLETransport } from '@hrkit/capacitor';
 * const transport = new CapacitorBLETransport();
 * const conn = await connectToDevice(transport, { prefer: [POLAR_H10] });
 * ```
 */
export class CapacitorBLETransport implements BLETransport {
  private clientPromise: Promise<CapacitorBleClient>;
  private initialized = false;
  private readonly scanTimeoutMs: number;
  private readonly androidNeverForLocation: boolean;

  constructor(options?: CapacitorBLETransportOptions) {
    this.scanTimeoutMs = options?.scanTimeoutMs ?? 10000;
    this.androidNeverForLocation = options?.androidNeverForLocation ?? true;
    this.clientPromise = options?.client ? Promise.resolve(options.client) : loadBleClient();
  }

  private async ensureInit(): Promise<CapacitorBleClient> {
    const client = await this.clientPromise;
    if (!this.initialized) {
      await client.initialize({ androidNeverForLocation: this.androidNeverForLocation });
      this.initialized = true;
    }
    return client;
  }

  async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    const client = await this.ensureInit();
    const seen = new Set<string>();
    const queue: HRDevice[] = [];
    let resolveNext: (() => void) | null = null;
    let stopped = false;

    const services = uniqueServices(profiles);
    const namePrefix = profiles?.find((p) => p.namePrefix)?.namePrefix;

    const callback = (result: { device: { deviceId: string; name?: string }; rssi?: number }): void => {
      if (seen.has(result.device.deviceId)) return;
      const matched =
        profiles?.find((p) => p.namePrefix && result.device.name?.startsWith(p.namePrefix)) ??
        profiles?.find((p) => p.namePrefix === '');
      if (profiles && profiles.length > 0 && !matched) return;
      seen.add(result.device.deviceId);
      queue.push({
        id: result.device.deviceId,
        name: result.device.name ?? 'Unknown',
        rssi: result.rssi ?? 0,
        profile: matched,
      });
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    };

    await client.requestLEScan(
      {
        ...(services.length > 0 ? { services } : {}),
        ...(namePrefix ? { namePrefix } : {}),
        allowDuplicates: false,
      },
      callback,
    );

    const timeout = setTimeout(() => {
      stopped = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    }, this.scanTimeoutMs);

    try {
      while (!stopped) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
          continue;
        }
        const next = queue.shift();
        if (next) yield next;
      }
    } finally {
      clearTimeout(timeout);
      await client.stopLEScan().catch(() => {});
    }
  }

  async stopScan(): Promise<void> {
    const client = await this.clientPromise;
    await client.stopLEScan().catch(() => {});
  }

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    const client = await this.ensureInit();

    let resolveDisconnect!: () => void;
    const onDisconnect = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    await client.connect(deviceId, () => resolveDisconnect());

    return new CapacitorHRConnection(client, deviceId, profile, onDisconnect, resolveDisconnect);
  }
}

class CapacitorHRConnection implements HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;
  readonly onDisconnect: Promise<void>;

  constructor(
    private client: CapacitorBleClient,
    deviceId: string,
    profile: DeviceProfile,
    onDisconnect: Promise<void>,
    private resolveDisconnect: () => void,
  ) {
    this.deviceId = deviceId;
    this.deviceName = deviceId; // Capacitor doesn't return name on connect; use ID
    this.profile = profile;
    this.onDisconnect = onDisconnect;
  }

  async *heartRate(): AsyncIterable<HRPacket> {
    const queue: HRPacket[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;

    const onValue = (value: DataView): void => {
      try {
        const packet = parseHeartRate(value);
        queue.push(packet);
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r();
        }
      } catch {
        // skip malformed frames
      }
    };

    await this.client.startNotifications(this.deviceId, GATT_HR_SERVICE_UUID, GATT_HR_MEASUREMENT_UUID, onValue);

    this.onDisconnect.then(() => {
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    });

    try {
      while (!done) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
          continue;
        }
        const next = queue.shift();
        if (next) yield next;
      }
    } finally {
      await this.client
        .stopNotifications(this.deviceId, GATT_HR_SERVICE_UUID, GATT_HR_MEASUREMENT_UUID)
        .catch(() => {});
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect(this.deviceId).catch(() => {});
    this.resolveDisconnect();
  }
}

function uniqueServices(profiles?: DeviceProfile[]): string[] {
  if (!profiles) return [];
  const set = new Set<string>();
  for (const p of profiles) for (const s of p.serviceUUIDs) set.add(s);
  return [...set];
}
