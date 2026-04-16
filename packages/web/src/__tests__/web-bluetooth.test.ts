import type { DeviceProfile } from '@hrkit/core';
import { GATT_HR_SERVICE_UUID } from '@hrkit/core';
import { describe, expect, it, vi } from 'vitest';
import { isWebBluetoothSupported, WebBluetoothTransport } from '../index.js';

// ── Helpers ─────────────────────────────────────────────────────────────

const GENERIC_HR: DeviceProfile = {
  brand: 'Generic',
  model: 'BLE HR sensor',
  namePrefix: '',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

const POLAR_H10: DeviceProfile = {
  brand: 'Polar',
  model: 'H10',
  namePrefix: 'Polar H10',
  capabilities: ['heartRate', 'rrIntervals', 'ecg'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};

/** Build a valid HR measurement buffer: flags=0x16 (8-bit HR, RR present), HR=75, RR=800 */
function makeHRBuffer(hr: number, rr?: number): DataView {
  const hasRR = rr !== undefined;
  const flags = hasRR ? 0x16 : 0x06; // contact supported+detected, RR present if rr given
  const buf = hasRR ? new ArrayBuffer(5) : new ArrayBuffer(2);
  const view = new DataView(buf);
  view.setUint8(0, flags);
  view.setUint8(1, hr);
  if (hasRR) {
    // RR in 1/1024s units
    const rawRR = Math.round((rr * 1024) / 1000);
    view.setUint16(2, rawRR, true);
  }
  return view;
}

// ── Mock Web Bluetooth API ──────────────────────────────────────────────

function createMockCharacteristic() {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    startNotifications: vi.fn().mockResolvedValue(undefined),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, cb: (event: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: (event: Event) => void) => {
      listeners.get(type)?.delete(cb);
    }),
    _emit(type: string, value: DataView) {
      for (const cb of listeners.get(type) ?? []) {
        cb({ target: { value } } as unknown as Event);
      }
    },
  };
}

function createMockBtDevice(id: string, name: string) {
  const listeners = new Map<string, Set<() => void>>();
  const hrChar = createMockCharacteristic();
  const device = {
    id,
    name,
    gatt: {
      connect: vi.fn().mockResolvedValue({
        getPrimaryService: vi.fn().mockResolvedValue({
          getCharacteristic: vi.fn().mockResolvedValue(hrChar),
        }),
        disconnect: vi.fn(),
      }),
    },
    addEventListener: vi.fn((type: string, cb: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      listeners.get(type)?.delete(cb);
    }),
    _simulateDisconnect() {
      for (const cb of listeners.get('gattserverdisconnected') ?? []) {
        cb();
      }
    },
    _hrChar: hrChar,
  };
  return device;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('isWebBluetoothSupported', () => {
  it('returns false in Node.js environment', () => {
    expect(isWebBluetoothSupported()).toBe(false);
  });
});

describe('WebBluetoothTransport', () => {
  it('implements BLETransport interface', () => {
    const transport = new WebBluetoothTransport();
    expect(typeof transport.scan).toBe('function');
    expect(typeof transport.stopScan).toBe('function');
    expect(typeof transport.connect).toBe('function');
  });

  it('stopScan is a no-op (Web Bluetooth is modal)', async () => {
    const transport = new WebBluetoothTransport();
    await expect(transport.stopScan()).resolves.toBeUndefined();
  });

  describe('scan', () => {
    it('yields a device from navigator.bluetooth.requestDevice', async () => {
      const mockDevice = { id: 'web-001', name: 'Polar H10 ABC' };
      const mockBluetooth = {
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      const devices = [];
      for await (const d of transport.scan([POLAR_H10, GENERIC_HR])) {
        devices.push(d);
      }

      expect(devices).toHaveLength(1);
      expect(devices[0]!.id).toBe('web-001');
      expect(devices[0]!.name).toBe('Polar H10 ABC');
      expect(devices[0]!.rssi).toBe(0); // Web Bluetooth doesn't expose RSSI
      expect(devices[0]!.profile).toBe(POLAR_H10);

      vi.unstubAllGlobals();
    });

    it('matches generic profile when no namePrefix matches', async () => {
      const mockDevice = { id: 'web-002', name: 'Unknown Strap' };
      const mockBluetooth = {
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      const devices = [];
      for await (const d of transport.scan([POLAR_H10, GENERIC_HR])) {
        devices.push(d);
      }

      expect(devices[0]!.profile).toBe(GENERIC_HR);

      vi.unstubAllGlobals();
    });

    it('uses HR service filter when no named profiles are given', async () => {
      const mockDevice = { id: 'web-003', name: 'HR Strap' };
      const mockBluetooth = {
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      for await (const _d of transport.scan([GENERIC_HR])) {
        break;
      }

      const callArgs = mockBluetooth.requestDevice.mock.calls[0]![0];
      expect(callArgs.filters).toEqual([{ services: [GATT_HR_SERVICE_UUID] }]);

      vi.unstubAllGlobals();
    });
  });

  describe('connect', () => {
    it('connects and returns a valid HRConnection', async () => {
      const btDevice = createMockBtDevice('web-010', 'Test HR');
      const mockBluetooth = {
        getDevices: vi.fn().mockResolvedValue([btDevice]),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      const conn = await transport.connect('web-010', GENERIC_HR);

      expect(conn.deviceId).toBe('web-010');
      expect(conn.deviceName).toBe('Test HR');
      expect(conn.profile).toBe(GENERIC_HR);
      expect(typeof conn.heartRate).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
      expect(conn.onDisconnect).toBeInstanceOf(Promise);

      await conn.disconnect();
      vi.unstubAllGlobals();
    });

    it('throws when device not found', async () => {
      const mockBluetooth = {
        getDevices: vi.fn().mockResolvedValue([]),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      await expect(transport.connect('missing', GENERIC_HR)).rejects.toThrow('not found');

      vi.unstubAllGlobals();
    });

    it('streams HR packets from characteristic notifications', async () => {
      const btDevice = createMockBtDevice('web-020', 'Test HR');
      const mockBluetooth = {
        getDevices: vi.fn().mockResolvedValue([btDevice]),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      const conn = await transport.connect('web-020', GENERIC_HR);

      const packets: { hr: number }[] = [];
      const iterator = conn.heartRate()[Symbol.asyncIterator]();

      // Emit after a microtask so the iterator is already awaiting
      setTimeout(() => {
        btDevice._hrChar._emit('characteristicvaluechanged', makeHRBuffer(72, 833));
      }, 10);

      const p1 = await iterator.next();
      packets.push(p1.value!);

      setTimeout(() => {
        btDevice._hrChar._emit('characteristicvaluechanged', makeHRBuffer(85, 706));
      }, 10);

      const p2 = await iterator.next();
      packets.push(p2.value!);

      expect(packets).toHaveLength(2);
      expect(packets[0]!.hr).toBe(72);
      expect(packets[1]!.hr).toBe(85);

      // Disconnect stops the stream
      btDevice._simulateDisconnect();
      const final = await iterator.next();
      expect(final.done).toBe(true);

      vi.unstubAllGlobals();
    });

    it('skips malformed packets without crashing', async () => {
      const btDevice = createMockBtDevice('web-030', 'Test HR');
      const mockBluetooth = {
        getDevices: vi.fn().mockResolvedValue([btDevice]),
      };
      vi.stubGlobal('navigator', { bluetooth: mockBluetooth });

      const transport = new WebBluetoothTransport();
      const conn = await transport.connect('web-030', GENERIC_HR);

      const iterator = conn.heartRate()[Symbol.asyncIterator]();

      // Emit a truncated packet (too short), then a valid one — after iterator starts
      setTimeout(() => {
        const badBuf = new DataView(new ArrayBuffer(1));
        badBuf.setUint8(0, 0x00);
        btDevice._hrChar._emit('characteristicvaluechanged', badBuf);
        btDevice._hrChar._emit('characteristicvaluechanged', makeHRBuffer(90));
      }, 10);

      const result = await iterator.next();
      expect(result.value!.hr).toBe(90); // skipped the bad one

      btDevice._simulateDisconnect();
      vi.unstubAllGlobals();
    });
  });
});
