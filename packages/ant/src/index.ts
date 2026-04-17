/**
 * @hrkit/ant — ANT+ bridge that exposes ANT+ sensors through the same
 * `BLETransport` interface used by `@hrkit/web` and friends.
 *
 * The actual ANT+ stick driver (`ant-plus-next`) is an OPTIONAL peer
 * dependency loaded dynamically. This keeps the package usable in
 * test environments and in browser bundles that should not include
 * USB code paths.
 */

import type { BLETransport, DeviceProfile, HRConnection, HRDevice, HRPacket } from '@hrkit/core';

// ── ANT+ device / message types ─────────────────────────────────────────

export type AntSensorType = 'hr' | 'power' | 'cadence' | 'speed';

export interface AntDataPoint {
  /** Timestamp in ms since epoch. */
  timestamp: number;
  /** Heart rate (bpm) — present for HR-capable sensors. */
  hr?: number;
  /** Instantaneous power (watts). */
  power?: number;
  /** Cadence (rpm). */
  cadence?: number;
  /** Speed (m/s). */
  speed?: number;
}

/**
 * Minimal interface a real or mock ANT+ stick must implement. This avoids a
 * direct compile-time dependency on `ant-plus-next` so the package
 * type-checks without USB libraries installed.
 */
export interface AntStick {
  open(): Promise<boolean>;
  close(): Promise<void>;
  attach(channel: AntChannel): void;
}

export interface AntChannel {
  readonly sensorType: AntSensorType;
  readonly deviceId: number;
  on(event: 'data', listener: (payload: AntDataPoint) => void): void;
  on(event: 'attached', listener: () => void): void;
  detach?(): void;
}

export interface AntTransportOptions {
  stick: AntStick;
  /** Channels to attach. Each becomes a discoverable HRDevice. */
  channels: AntChannel[];
  /** Map ANT sensor type to a hrkit DeviceProfile. */
  profileFor: (channel: AntChannel) => DeviceProfile;
}

// ── Adapter implementation ─────────────────────────────────────────────

class AntConnection implements HRConnection {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly profile: DeviceProfile;
  readonly onDisconnect: Promise<void>;

  private resolveDisconnect!: () => void;
  private listeners: Array<(p: HRPacket) => void> = [];
  private buffer: HRPacket[] = [];
  private waiting: Array<(v: IteratorResult<HRPacket>) => void> = [];
  private done = false;

  constructor(channel: AntChannel, profile: DeviceProfile) {
    this.deviceId = `ant:${channel.sensorType}:${channel.deviceId}`;
    this.deviceName = `ANT+ ${channel.sensorType} #${channel.deviceId}`;
    this.profile = profile;
    this.onDisconnect = new Promise((res) => {
      this.resolveDisconnect = res;
    });

    channel.on('data', (d: AntDataPoint) => {
      if (typeof d.hr !== 'number') return; // only HR maps to HRPacket
      const packet: HRPacket = { hr: d.hr, timestamp: d.timestamp, rrIntervals: [], contactDetected: true };
      this.dispatch(packet);
    });
  }

  private dispatch(p: HRPacket) {
    if (this.waiting.length > 0) {
      this.waiting.shift()!({ value: p, done: false });
    } else {
      this.buffer.push(p);
    }
    for (const l of this.listeners) l(p);
  }

  heartRate(): AsyncIterable<HRPacket> {
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<HRPacket>> {
            if (self.buffer.length > 0) {
              return Promise.resolve({ value: self.buffer.shift()!, done: false });
            }
            if (self.done) return Promise.resolve({ value: undefined, done: true });
            return new Promise((res) => self.waiting.push(res));
          },
          return(): Promise<IteratorResult<HRPacket>> {
            self.done = true;
            for (const w of self.waiting) w({ value: undefined, done: true });
            self.waiting = [];
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };
  }

  async disconnect(): Promise<void> {
    if (this.done) return;
    this.done = true;
    for (const w of this.waiting) w({ value: undefined, done: true });
    this.waiting = [];
    this.resolveDisconnect();
  }
}

export class AntTransport implements BLETransport {
  private opened = false;
  constructor(private readonly opts: AntTransportOptions) {}

  scan(_profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
    const channels = this.opts.channels;
    const profileFor = this.opts.profileFor;
    return {
      async *[Symbol.asyncIterator]() {
        for (const ch of channels) {
          yield {
            id: `ant:${ch.sensorType}:${ch.deviceId}`,
            name: `ANT+ ${ch.sensorType} #${ch.deviceId}`,
            rssi: 0,
            profile: profileFor(ch),
          };
        }
      },
    };
  }

  async stopScan(): Promise<void> {
    /* no-op; scan() is synchronous over a fixed channel list */
  }

  async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
    if (!this.opened) {
      const ok = await this.opts.stick.open();
      if (!ok) throw new Error('ANT+ stick failed to open');
      this.opened = true;
    }
    const channel = this.opts.channels.find((c) => `ant:${c.sensorType}:${c.deviceId}` === deviceId);
    if (!channel) throw new Error(`ANT+ device ${deviceId} not registered`);
    this.opts.stick.attach(channel);
    return new AntConnection(channel, profile);
  }

  async close(): Promise<void> {
    if (this.opened) await this.opts.stick.close();
    this.opened = false;
  }
}

/**
 * Helper that lazily loads `ant-plus-next` (if installed) and returns a stick
 * implementing the `AntStick` interface. Throws a clear error if the package
 * is missing — install it with `npm install ant-plus-next`.
 */
export async function loadGarminStick(): Promise<AntStick> {
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ 'ant-plus-next' as string);
  } catch (err) {
    throw new Error(
      `ant-plus-next is required to use loadGarminStick(). Install it with 'npm install ant-plus-next'. (${(err as Error).message})`,
    );
  }
  const m = mod as { GarminStick3?: new () => AntStick; GarminStick2?: new () => AntStick };
  const Ctor = m.GarminStick3 ?? m.GarminStick2;
  if (!Ctor) throw new Error('ant-plus-next: no Garmin stick class exported');
  return new Ctor();
}
