import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';
import { describe, expect, it, vi } from 'vitest';
import { isBleManagerReady, ReactNativeTransport } from '../index.js';

// ── Helpers ─────────────────────────────────────────────────────────────

const GENERIC_HR: DeviceProfile = {
  brand: 'Generic',
  model: 'BLE HR sensor',
  namePrefix: '',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Encode a DataView as base64 (simulates react-native-ble-plx characteristic values). */
function dataViewToBase64(view: DataView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/** Build a valid HR measurement: flags=0x16 (8-bit HR, contact, RR), HR=hr, RR=rr */
function makeHRBase64(hr: number, rr?: number): string {
  const hasRR = rr !== undefined;
  const flags = hasRR ? 0x16 : 0x06;
  const buf = hasRR ? new ArrayBuffer(5) : new ArrayBuffer(2);
  const view = new DataView(buf);
  view.setUint8(0, flags);
  view.setUint8(1, hr);
  if (hasRR) {
    const rawRR = Math.round((rr * 1024) / 1000);
    view.setUint16(2, rawRR, true);
  }
  return dataViewToBase64(view);
}

// ── Mock BleManager ─────────────────────────────────────────────────────

function createMockManager() {
  let scanCallback: ((error: unknown, device: unknown) => void) | null = null;
  let monitorListener: ((error: unknown, char: unknown) => void) | null = null;
  let disconnectListener: ((error: unknown, device: unknown) => void) | null = null;

  const manager = {
    startDeviceScan: vi.fn(
      (_uuids: string[] | null, _options: unknown, callback: (error: unknown, device: unknown) => void) => {
        scanCallback = callback;
      },
    ),
    stopDeviceScan: vi.fn(),
    connectToDevice: vi.fn().mockImplementation((deviceId: string) =>
      Promise.resolve({
        id: deviceId,
        name: 'Mock Device',
        discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValue({
          id: deviceId,
          name: 'Mock Device',
        }),
        monitorCharacteristicForService: vi.fn(
          (_serviceUUID: string, _charUUID: string, listener: (error: unknown, char: unknown) => void) => {
            monitorListener = listener;
            return { remove: vi.fn() };
          },
        ),
        cancelConnection: vi.fn().mockResolvedValue({ id: deviceId }),
        onDisconnected: vi.fn((listener: (error: unknown, device: unknown) => void) => {
          disconnectListener = listener;
          return { remove: vi.fn() };
        }),
      }),
    ),
    _emitDevice(device: {
      id: string;
      name: string | null;
      localName: string | null;
      rssi: number | null;
      serviceUUIDs: string[] | null;
    }) {
      scanCallback?.(null, device);
    },
    _emitCharacteristic(value: string | null) {
      monitorListener?.(null, value !== null ? { value } : null);
    },
    _emitError() {
      monitorListener?.(new Error('BLE error'), null);
    },
    _emitDisconnect() {
      disconnectListener?.(null, { id: 'dev' });
    },
  };

  return manager;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('isBleManagerReady', () => {
  it('returns true for valid manager', () => {
    const manager = createMockManager();
    expect(isBleManagerReady(manager)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isBleManagerReady(null)).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isBleManagerReady({})).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isBleManagerReady('string')).toBe(false);
  });
});

describe('ReactNativeTransport', () => {
  it('implements BLETransport interface', () => {
    const manager = createMockManager();
    const transport = new ReactNativeTransport(manager as never);

    expect(typeof transport.scan).toBe('function');
    expect(typeof transport.stopScan).toBe('function');
    expect(typeof transport.connect).toBe('function');
  });

  describe('scan', () => {
    it('yields discovered devices', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);

      const devices: unknown[] = [];
      const scanPromise = (async () => {
        for await (const d of transport.scan([GENERIC_HR])) {
          devices.push(d);
          if (devices.length >= 2) break;
        }
      })();

      // Wait for scan to start
      await new Promise((r) => setTimeout(r, 10));

      manager._emitDevice({
        id: 'rn-001',
        name: 'HR Strap',
        localName: null,
        rssi: -60,
        serviceUUIDs: [GATT_HR_SERVICE_UUID],
      });
      manager._emitDevice({
        id: 'rn-002',
        name: 'HR Strap 2',
        localName: null,
        rssi: -70,
        serviceUUIDs: [GATT_HR_SERVICE_UUID],
      });

      await scanPromise;

      expect(devices).toHaveLength(2);
      expect((devices[0] as { id: string }).id).toBe('rn-001');
      expect((devices[1] as { id: string }).id).toBe('rn-002');
    });

    it('deduplicates devices by id', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);

      const devices: unknown[] = [];
      const scanPromise = (async () => {
        for await (const d of transport.scan([GENERIC_HR])) {
          devices.push(d);
          if (devices.length >= 2) break;
        }
      })();

      await new Promise((r) => setTimeout(r, 10));

      // Emit same device twice, then a different one
      manager._emitDevice({
        id: 'rn-dup',
        name: 'Dup',
        localName: null,
        rssi: -50,
        serviceUUIDs: null,
      });
      manager._emitDevice({
        id: 'rn-dup',
        name: 'Dup',
        localName: null,
        rssi: -50,
        serviceUUIDs: null,
      });
      manager._emitDevice({
        id: 'rn-other',
        name: 'Other',
        localName: null,
        rssi: -60,
        serviceUUIDs: null,
      });

      await scanPromise;

      expect(devices).toHaveLength(2);
      expect((devices[0] as { id: string }).id).toBe('rn-dup');
      expect((devices[1] as { id: string }).id).toBe('rn-other');
    });

    it('calls stopDeviceScan on break', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);

      const scanPromise = (async () => {
        for await (const _d of transport.scan()) {
          break;
        }
      })();

      await new Promise((r) => setTimeout(r, 10));
      manager._emitDevice({
        id: 'rn-stop',
        name: 'Stop',
        localName: null,
        rssi: -50,
        serviceUUIDs: null,
      });
      await scanPromise;

      expect(manager.stopDeviceScan).toHaveBeenCalled();
    });
  });

  describe('stopScan', () => {
    it('delegates to manager.stopDeviceScan', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);
      await transport.stopScan();
      expect(manager.stopDeviceScan).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('returns a valid HRConnection', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);
      const conn = await transport.connect('rn-010', GENERIC_HR);

      expect(conn.deviceId).toBe('rn-010');
      expect(conn.deviceName).toBe('Mock Device');
      expect(conn.profile).toBe(GENERIC_HR);
      expect(typeof conn.heartRate).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
      expect(conn.onDisconnect).toBeInstanceOf(Promise);

      await conn.disconnect();
    });

    it('streams HR packets from characteristic monitor', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);
      const conn = await transport.connect('rn-020', GENERIC_HR);

      const packets: { hr: number }[] = [];
      const iterator = conn.heartRate()[Symbol.asyncIterator]();

      // Emit after a microtask so the iterator is already awaiting
      setTimeout(() => {
        manager._emitCharacteristic(makeHRBase64(72, 833));
      }, 10);

      const p1 = await iterator.next();
      packets.push(p1.value!);

      setTimeout(() => {
        manager._emitCharacteristic(makeHRBase64(85, 706));
      }, 10);

      const p2 = await iterator.next();
      packets.push(p2.value!);

      expect(packets).toHaveLength(2);
      expect(packets[0]!.hr).toBe(72);
      expect(packets[1]!.hr).toBe(85);

      // Signal error to end stream
      manager._emitError();
      const final = await iterator.next();
      expect(final.done).toBe(true);
    });

    it('skips malformed base64 packets without crashing', async () => {
      const manager = createMockManager();
      const transport = new ReactNativeTransport(manager as never);
      const conn = await transport.connect('rn-030', GENERIC_HR);

      const iterator = conn.heartRate()[Symbol.asyncIterator]();

      // Emit truncated data (1 byte = too short), then valid — after iterator starts
      setTimeout(() => {
        const badBuf = new DataView(new ArrayBuffer(1));
        badBuf.setUint8(0, 0x00);
        manager._emitCharacteristic(dataViewToBase64(badBuf));
        manager._emitCharacteristic(makeHRBase64(90));
      }, 10);

      const result = await iterator.next();
      expect(result.value!.hr).toBe(90);

      manager._emitError();
    });
  });
});
