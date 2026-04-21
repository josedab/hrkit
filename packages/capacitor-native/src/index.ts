export { SDK_NAME, SDK_VERSION } from './version.js';

/**
 * @hrkit/capacitor-native — JS bridge for the native Capacitor plugin.
 *
 * The native side (Swift/Kotlin under `ios/` and `android/`) talks directly
 * to the platform BLE stack — no community plugin dependency. This file
 * exposes a {@link createCapacitorNativeTransport} that wraps the plugin in
 * the standard `@hrkit/core` `BLETransport` interface.
 *
 * The Capacitor plugin host (`@capacitor/core`) is loaded lazily so this
 * package can be imported (and unit-tested) from non-Capacitor environments.
 */

import {
  type BLETransport,
  ConnectionError,
  type DeviceProfile,
  GATT_HR_MEASUREMENT_UUID,
  GATT_HR_SERVICE_UUID,
  type HRConnection,
  type HRDevice,
  HRKitError,
  type HRPacket,
  parseHeartRate,
} from '@hrkit/core';

/** Subset of the `@capacitor/core` API we depend on. */
interface CapacitorCoreLike {
  registerPlugin: <T = unknown>(name: string, options?: unknown) => T;
}

/** Native plugin shape — implemented by Swift/Kotlin code. */
export interface HrkitNativePlugin {
  startScan(opts: { services?: string[]; timeoutMs?: number }): Promise<void>;
  stopScan(): Promise<void>;
  connect(opts: { deviceId: string }): Promise<{ deviceId: string; name?: string }>;
  disconnect(opts: { deviceId: string }): Promise<void>;
  startNotifications(opts: { deviceId: string; service: string; characteristic: string }): Promise<void>;
  stopNotifications(opts: { deviceId: string; service: string; characteristic: string }): Promise<void>;
  addListener(
    event: 'scanResult' | 'gattNotification' | 'connectionStateChange',
    cb: (data: unknown) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

let cachedPlugin: HrkitNativePlugin | null = null;

/** Resolve the native plugin from `@capacitor/core`. */
export async function loadNativePlugin(): Promise<HrkitNativePlugin> {
  if (cachedPlugin) return cachedPlugin;
  const mod = (await import(/* @vite-ignore */ '@capacitor/core')) as CapacitorCoreLike;
  if (!mod?.registerPlugin)
    throw new HRKitError('@capacitor/core not available — install Capacitor in your app.', 'MISSING_PEER');
  cachedPlugin = mod.registerPlugin<HrkitNativePlugin>('HrkitNative');
  return cachedPlugin;
}

export interface CapacitorNativeTransportOptions {
  /** Override the plugin reference (used in tests). */
  plugin?: HrkitNativePlugin;
  /** Scan duration before yielding control. Default: 10000ms. */
  scanTimeoutMs?: number;
}

interface ScanResultEvent {
  deviceId: string;
  name?: string;
  rssi?: number;
}

interface GattNotificationEvent {
  deviceId: string;
  service: string;
  characteristic: string;
  /** Hex-encoded payload — base64 also accepted (`b64` field). */
  hex?: string;
  b64?: string;
}

function hexToDataView(hex: string): DataView {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  return new DataView(bytes.buffer);
}

function b64ToDataView(b64: string): DataView {
  const bin =
    typeof atob === 'function'
      ? atob(b64)
      : ((
          globalThis as { Buffer?: { from(data: string, enc: string): { toString(enc: string): string } } }
        ).Buffer?.from(b64, 'base64').toString('binary') ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new DataView(bytes.buffer);
}

class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: ((v: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(v: T): void {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      const w = this.waiters.shift();
      w?.({ value: undefined as unknown as T, done: true });
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) return Promise.resolve({ value: this.items.shift() as T, done: false });
    if (this.closed) return Promise.resolve({ value: undefined as unknown as T, done: true });
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  [Symbol.asyncIterator]() {
    return { next: () => this.next() };
  }
}

/**
 * Build a {@link BLETransport} backed by the native Capacitor plugin.
 *
 * @example
 * ```ts
 * const transport = await createCapacitorNativeTransport();
 * for await (const dev of transport.scan()) console.log(dev);
 * ```
 */
export async function createCapacitorNativeTransport(
  opts: CapacitorNativeTransportOptions = {},
): Promise<BLETransport> {
  const p = opts.plugin ?? (await loadNativePlugin());
  const scanTimeoutMs = opts.scanTimeoutMs ?? 10_000;

  const transport: BLETransport = {
    async *scan(profiles?: DeviceProfile[], options?: { signal?: AbortSignal }): AsyncIterable<HRDevice> {
      if (options?.signal?.aborted) return;
      options?.signal?.addEventListener(
        'abort',
        () => {
          void p.stopScan();
        },
        { once: true },
      );
      const services = profiles?.flatMap((pr) => pr.serviceUUIDs) ?? [GATT_HR_SERVICE_UUID];
      const queue = new AsyncQueue<HRDevice>();

      const sub = await p.addListener('scanResult', (raw) => {
        const evt = raw as ScanResultEvent;
        queue.push({
          id: evt.deviceId,
          name: evt.name ?? 'Unknown',
          rssi: evt.rssi ?? 0,
          profile: profiles?.[0],
        });
      });
      await p.startScan({ services, timeoutMs: scanTimeoutMs });

      try {
        for await (const dev of queue) yield dev;
      } finally {
        await sub.remove();
      }
    },

    async stopScan(): Promise<void> {
      await p.stopScan();
    },

    async connect(deviceId: string, profile: DeviceProfile, options?: { signal?: AbortSignal }): Promise<HRConnection> {
      if (options?.signal?.aborted) throw new ConnectionError('connect aborted');
      const info = await p.connect({ deviceId });
      if (options?.signal?.aborted) {
        await p.disconnect({ deviceId }).catch(() => {});
        throw new ConnectionError('connect aborted');
      }

      let resolveDisconnect: (() => void) | null = null;
      const onDisconnect = new Promise<void>((res) => {
        resolveDisconnect = res;
      });
      const stateSub = await p.addListener('connectionStateChange', (raw) => {
        const evt = raw as { deviceId: string; connected: boolean };
        if (evt.deviceId === deviceId && !evt.connected) resolveDisconnect?.();
      });

      const connectAbort = (): void => {
        p.disconnect({ deviceId }).catch(() => {
          /* already gone */
        });
      };
      options?.signal?.addEventListener('abort', connectAbort, { once: true });

      const connection: HRConnection = {
        deviceId: info.deviceId,
        deviceName: info.name ?? 'Unknown',
        profile,
        onDisconnect: onDisconnect.finally(() => {
          options?.signal?.removeEventListener('abort', connectAbort);
          stateSub.remove();
        }),
        async *heartRate(hrOptions?: { signal?: AbortSignal }): AsyncIterable<HRPacket> {
          if (hrOptions?.signal?.aborted) return;
          const queue = new AsyncQueue<HRPacket>();
          const sub = await p.addListener('gattNotification', (raw) => {
            const evt = raw as GattNotificationEvent;
            if (evt.deviceId !== deviceId) return;
            if (evt.characteristic.toLowerCase() !== GATT_HR_MEASUREMENT_UUID.toLowerCase()) return;
            const view = evt.hex ? hexToDataView(evt.hex) : evt.b64 ? b64ToDataView(evt.b64) : null;
            if (!view) return;
            try {
              const pkt = parseHeartRate(view);
              queue.push(pkt);
            } catch {
              /* skip malformed */
            }
          });
          await p.startNotifications({
            deviceId,
            service: GATT_HR_SERVICE_UUID,
            characteristic: GATT_HR_MEASUREMENT_UUID,
          });
          const onAbort = (): void => queue.close();
          hrOptions?.signal?.addEventListener('abort', onAbort, { once: true });
          try {
            for await (const pkt of queue) yield pkt;
          } finally {
            hrOptions?.signal?.removeEventListener('abort', onAbort);
            await sub.remove();
            await p
              .stopNotifications({ deviceId, service: GATT_HR_SERVICE_UUID, characteristic: GATT_HR_MEASUREMENT_UUID })
              .catch(() => {});
          }
        },
        async disconnect(): Promise<void> {
          options?.signal?.removeEventListener('abort', connectAbort);
          await p.disconnect({ deviceId });
          resolveDisconnect?.();
        },
      };

      return connection;
    },
  };

  return transport;
}
