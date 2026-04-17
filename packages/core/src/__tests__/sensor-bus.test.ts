import { describe, expect, it, vi } from 'vitest';
import {
  DEXCOM_SHARE_CGM,
  GATT_FTMS_SERVICE_UUID,
  GATT_GLUCOSE_SERVICE_UUID,
  GENERIC_FTMS_TRAINER,
  GENERIC_GLUCOSE_METER,
  LIBRE_LINKUP_CGM,
  SARIS_H3,
  SensorBus,
  TACX_NEO,
  WAHOO_KICKR,
} from '../index.js';

describe('SensorBus', () => {
  it('fans out events to all subscribers', () => {
    const bus = new SensorBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.subscribe(handler1);
    bus.subscribe(handler2);
    bus.emit({ kind: 'hr', timestamp: 1, source: 'strap', bpm: 140 });
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('on(kind) filters to a single event type with type narrowing', () => {
    const bus = new SensorBus();
    const hrHandler = vi.fn();
    const powerHandler = vi.fn();
    bus.on('hr', hrHandler);
    bus.on('power', powerHandler);
    bus.emit({ kind: 'hr', timestamp: 1, source: 'strap', bpm: 140 });
    bus.emit({ kind: 'power', timestamp: 2, source: 'kickr', watts: 250 });
    bus.emit({ kind: 'hr', timestamp: 3, source: 'strap', bpm: 145 });
    expect(hrHandler).toHaveBeenCalledTimes(2);
    expect(powerHandler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further deliveries', () => {
    const bus = new SensorBus();
    const handler = vi.fn();
    const unsub = bus.subscribe(handler);
    bus.emit({ kind: 'hr', timestamp: 1, source: 'strap', bpm: 100 });
    unsub();
    bus.emit({ kind: 'hr', timestamp: 2, source: 'strap', bpm: 110 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('exposes events$ ReadableStream view', () => {
    const bus = new SensorBus();
    expect(bus.events$).toBeDefined();
    expect(typeof bus.events$.subscribe).toBe('function');
  });

  it('supports glucose, trainer, and weight events', () => {
    const bus = new SensorBus();
    const seen: string[] = [];
    bus.subscribe((e) => seen.push(e.kind));
    bus.emit({ kind: 'glucose', timestamp: 1, source: 'libre', mgdl: 110, trend: 0 });
    bus.emit({ kind: 'trainer', timestamp: 2, source: 'kickr', resistanceWatts: 200 });
    bus.emit({ kind: 'weight', timestamp: 3, source: 'scale', kg: 75, bodyFatPct: 18 });
    expect(seen).toEqual(['glucose', 'trainer', 'weight']);
  });
});

describe('Capability v2 device profiles', () => {
  it('FTMS trainer profiles declare smartTrainer + correct service UUID', () => {
    for (const p of [WAHOO_KICKR, TACX_NEO, SARIS_H3, GENERIC_FTMS_TRAINER]) {
      expect(p.capabilities).toContain('smartTrainer');
      expect(p.serviceUUIDs).toContain(GATT_FTMS_SERVICE_UUID);
    }
  });

  it('hardware CGM profile declares glucose + GATT 0x1808', () => {
    expect(GENERIC_GLUCOSE_METER.capabilities).toContain('glucose');
    expect(GENERIC_GLUCOSE_METER.serviceUUIDs).toContain(GATT_GLUCOSE_SERVICE_UUID);
  });

  it('cloud-CGM profiles declare glucose with no BLE service UUID', () => {
    for (const p of [DEXCOM_SHARE_CGM, LIBRE_LINKUP_CGM]) {
      expect(p.capabilities).toContain('glucose');
      expect(p.serviceUUIDs).toEqual([]);
    }
  });
});
