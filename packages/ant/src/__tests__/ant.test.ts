import type { DeviceProfile } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { type AntChannel, type AntDataPoint, type AntStick, AntTransport } from '../index.js';

const PROFILE: DeviceProfile = {
  brand: 'Generic',
  model: 'ANT+ HR',
  namePrefix: 'ANT',
  capabilities: ['heartRate'],
  serviceUUIDs: ['0000180d-0000-1000-8000-00805f9b34fb'],
};

class MockStick implements AntStick {
  attached: AntChannel[] = [];
  opened = false;
  async open() {
    this.opened = true;
    return true;
  }
  async close() {
    this.opened = false;
  }
  attach(ch: AntChannel) {
    this.attached.push(ch);
  }
}

class MockChannel implements AntChannel {
  private dataListeners: Array<(p: AntDataPoint) => void> = [];
  constructor(
    public sensorType: 'hr' | 'power' | 'cadence' | 'speed',
    public deviceId: number,
  ) {}
  on(event: 'data' | 'attached', listener: ((p: AntDataPoint) => void) | (() => void)): void {
    if (event === 'data') this.dataListeners.push(listener as (p: AntDataPoint) => void);
  }
  emit(p: AntDataPoint) {
    for (const l of this.dataListeners) l(p);
  }
}

describe('@hrkit/ant AntTransport', () => {
  it('lists registered channels via scan()', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 12345);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const devices = [];
    for await (const d of t.scan()) devices.push(d);
    expect(devices).toHaveLength(1);
    expect(devices[0]!.id).toBe('ant:hr:12345');
  });

  it('opens stick on first connect and yields HR packets', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 99);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:hr:99', PROFILE);
    expect(stick.opened).toBe(true);
    expect(stick.attached).toContain(ch);

    const iter = conn.heartRate()[Symbol.asyncIterator]();
    setTimeout(() => ch.emit({ timestamp: Date.now(), hr: 142 }), 5);
    const r = await iter.next();
    expect(r.value).toMatchObject({ hr: 142 });
    await conn.disconnect();
    await t.close();
    expect(stick.opened).toBe(false);
  });

  it('connect on unknown device throws', async () => {
    const stick = new MockStick();
    const t = new AntTransport({ stick, channels: [], profileFor: () => PROFILE });
    await expect(t.connect('ant:hr:1', PROFILE)).rejects.toThrow(/not registered/);
  });

  it('skips non-HR data points', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('power', 1);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:power:1', PROFILE);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    ch.emit({ timestamp: Date.now(), power: 250 });
    setTimeout(() => ch.emit({ timestamp: Date.now(), hr: 100 }), 5);
    const r = await iter.next();
    expect(r.value).toMatchObject({ hr: 100 });
    await conn.disconnect();
  });

  it('disconnect resolves onDisconnect promise', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 7);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:hr:7', PROFILE);
    let resolved = false;
    conn.onDisconnect.then(() => {
      resolved = true;
    });
    await conn.disconnect();
    await new Promise((r) => setTimeout(r, 5));
    expect(resolved).toBe(true);
  });

  it('throws ConnectionError when stick.open() returns false', async () => {
    const stick = new MockStick();
    stick.open = async () => false;
    const ch = new MockChannel('hr', 1);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    await expect(t.connect('ant:hr:1', PROFILE)).rejects.toThrow(/failed to open/);
  });

  it('stopScan resolves without error', async () => {
    const stick = new MockStick();
    const t = new AntTransport({ stick, channels: [], profileFor: () => PROFILE });
    await expect(t.stopScan()).resolves.toBeUndefined();
  });

  it('scans multiple channels of different sensor types', async () => {
    const stick = new MockStick();
    const hrCh = new MockChannel('hr', 1);
    const pwrCh = new MockChannel('power', 2);
    const cadCh = new MockChannel('cadence', 3);
    const spdCh = new MockChannel('speed', 4);
    const t = new AntTransport({
      stick,
      channels: [hrCh, pwrCh, cadCh, spdCh],
      profileFor: () => PROFILE,
    });
    const devices = [];
    for await (const d of t.scan()) devices.push(d);
    expect(devices).toHaveLength(4);
    expect(devices[0]!.id).toBe('ant:hr:1');
    expect(devices[1]!.id).toBe('ant:power:2');
    expect(devices[2]!.id).toBe('ant:cadence:3');
    expect(devices[3]!.id).toBe('ant:speed:4');
  });

  it('does not reopen stick on second connect', async () => {
    const stick = new MockStick();
    let openCount = 0;
    const origOpen = stick.open.bind(stick);
    stick.open = async () => {
      openCount++;
      return origOpen();
    };
    const ch1 = new MockChannel('hr', 1);
    const ch2 = new MockChannel('hr', 2);
    const t = new AntTransport({ stick, channels: [ch1, ch2], profileFor: () => PROFILE });
    await t.connect('ant:hr:1', PROFILE);
    await t.connect('ant:hr:2', PROFILE);
    expect(openCount).toBe(1);
  });

  it('double disconnect is idempotent', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 5);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:hr:5', PROFILE);
    await conn.disconnect();
    await conn.disconnect(); // should not throw
  });

  it('buffered packets are returned before waiting for new ones', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 10);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:hr:10', PROFILE);
    // Emit data before starting iteration
    ch.emit({ timestamp: 1, hr: 70 });
    ch.emit({ timestamp: 2, hr: 75 });
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const r1 = await iter.next();
    const r2 = await iter.next();
    expect(r1.value).toMatchObject({ hr: 70 });
    expect(r2.value).toMatchObject({ hr: 75 });
    await conn.disconnect();
  });

  it('iterator return() ends the stream', async () => {
    const stick = new MockStick();
    const ch = new MockChannel('hr', 20);
    const t = new AntTransport({ stick, channels: [ch], profileFor: () => PROFILE });
    const conn = await t.connect('ant:hr:20', PROFILE);
    const iter = conn.heartRate()[Symbol.asyncIterator]();
    const ret = await iter.return!();
    expect(ret.done).toBe(true);
    const next = await iter.next();
    expect(next.done).toBe(true);
  });

  it('close is safe when stick was never opened', async () => {
    const stick = new MockStick();
    const t = new AntTransport({ stick, channels: [], profileFor: () => PROFILE });
    await expect(t.close()).resolves.toBeUndefined();
    expect(stick.opened).toBe(false);
  });
});
