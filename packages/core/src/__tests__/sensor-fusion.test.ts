import { describe, expect, it } from 'vitest';
import { SensorFusion } from '../sensor-fusion.js';

describe('SensorFusion', () => {
  it('returns null when no sources registered', () => {
    const fusion = new SensorFusion();
    expect(fusion.getFused()).toBeNull();
  });

  it('returns null when no readings pushed', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'a', label: 'Test', type: 'chest_strap' });
    expect(fusion.getFused()).toBeNull();
  });

  it('returns single source value when only one source', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'chest', label: 'Polar H10', type: 'chest_strap' });
    const now = Date.now();
    fusion.pushReading({ sourceId: 'chest', hr: 72, timestamp: now });
    const fused = fusion.getFused(now);
    expect(fused).not.toBeNull();
    expect(fused!.hr).toBeCloseTo(72, 0);
    expect(fused!.primarySourceId).toBe('chest');
    expect(fused!.activeSourceCount).toBe(1);
  });

  it('weights chest strap higher than optical wrist', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'chest', label: 'Polar H10', type: 'chest_strap' });
    fusion.addSource({ id: 'watch', label: 'Apple Watch', type: 'optical_wrist' });
    const now = Date.now();

    fusion.pushReading({ sourceId: 'chest', hr: 70, timestamp: now });
    fusion.pushReading({ sourceId: 'watch', hr: 80, timestamp: now });

    const fused = fusion.getFused(now);
    expect(fused).not.toBeNull();
    // Fused HR should be closer to 70 (chest strap has higher quality)
    expect(fused!.hr).toBeLessThan(76);
    expect(fused!.hr).toBeGreaterThan(69);
  });

  it('ECG source has highest quality', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'ecg', label: 'ECG', type: 'ecg' });
    fusion.addSource({ id: 'wrist', label: 'Wrist', type: 'optical_wrist' });
    const now = Date.now();

    fusion.pushReading({ sourceId: 'ecg', hr: 65, timestamp: now });
    fusion.pushReading({ sourceId: 'wrist', hr: 75, timestamp: now });

    const fused = fusion.getFused(now);
    expect(fused!.hr).toBeLessThan(70); // closer to ECG
    expect(fused!.primarySourceId).toBe('ecg');
  });

  it('ignores stale sources', () => {
    const fusion = new SensorFusion({ staleThresholdMs: 3000 });
    fusion.addSource({ id: 'a', label: 'A', type: 'chest_strap' });
    fusion.addSource({ id: 'b', label: 'B', type: 'optical_wrist' });

    const now = Date.now();
    fusion.pushReading({ sourceId: 'a', hr: 70, timestamp: now - 10000 }); // stale
    fusion.pushReading({ sourceId: 'b', hr: 80, timestamp: now });

    const fused = fusion.getFused(now);
    expect(fused!.activeSourceCount).toBe(1);
    expect(fused!.hr).toBeCloseTo(80, 0);
  });

  it('degrades quality on artifact spikes', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'noisy', label: 'Noisy', type: 'optical_wrist' });
    const now = Date.now();

    // Normal readings
    fusion.pushReading({ sourceId: 'noisy', hr: 70, timestamp: now });
    // Artifact: >30bpm jump in <2s
    fusion.pushReading({ sourceId: 'noisy', hr: 110, timestamp: now + 500 });
    fusion.pushReading({ sourceId: 'noisy', hr: 72, timestamp: now + 1000 });

    const qualities = fusion.getSourceQualities();
    expect(qualities.get('noisy')!).toBeLessThan(0.65); // degraded from initial 0.65
  });

  it('tracks multiple readings and converges', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'chest', label: 'Chest', type: 'chest_strap' });
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      fusion.pushReading({ sourceId: 'chest', hr: 72 + Math.random() * 2, timestamp: now + i * 1000 });
    }

    const fused = fusion.getFused(now + 9000);
    expect(fused!.hr).toBeGreaterThan(70);
    expect(fused!.hr).toBeLessThan(76);
    expect(fused!.uncertainty).toBeGreaterThan(0);
  });

  it('removeSource stops contributing', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'a', label: 'A', type: 'chest_strap' });
    fusion.addSource({ id: 'b', label: 'B', type: 'optical_wrist' });
    const now = Date.now();

    fusion.pushReading({ sourceId: 'a', hr: 70, timestamp: now });
    fusion.pushReading({ sourceId: 'b', hr: 80, timestamp: now });
    fusion.removeSource('a');

    const fused = fusion.getFused(now);
    expect(fused!.activeSourceCount).toBe(1);
    expect(fused!.hr).toBeCloseTo(80, 0);
  });

  it('ignores readings from unknown sources', () => {
    const fusion = new SensorFusion();
    fusion.pushReading({ sourceId: 'ghost', hr: 70, timestamp: Date.now() });
    expect(fusion.getFused()).toBeNull();
  });

  it('sourceIds returns registered source IDs', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'a', label: 'A', type: 'chest_strap' });
    fusion.addSource({ id: 'b', label: 'B', type: 'optical_wrist' });
    expect(fusion.sourceIds).toEqual(['a', 'b']);
  });

  it('provides uncertainty estimate', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'a', label: 'A', type: 'chest_strap' });
    fusion.addSource({ id: 'b', label: 'B', type: 'optical_wrist' });
    const now = Date.now();

    fusion.pushReading({ sourceId: 'a', hr: 70, timestamp: now });
    fusion.pushReading({ sourceId: 'b', hr: 75, timestamp: now });

    const fused = fusion.getFused(now);
    expect(fused!.uncertainty).toBeGreaterThan(0);
    expect(fused!.uncertainty).toBeLessThan(20);
  });

  it('handles "other" source type', () => {
    const fusion = new SensorFusion();
    fusion.addSource({ id: 'custom', label: 'Custom', type: 'other' });
    const now = Date.now();
    fusion.pushReading({ sourceId: 'custom', hr: 65, timestamp: now });
    const fused = fusion.getFused(now);
    expect(fused!.hr).toBeCloseTo(65, 0);
  });

  it('respects minQuality threshold', () => {
    const fusion = new SensorFusion({ minQuality: 0.8 });
    fusion.addSource({ id: 'wrist', label: 'Wrist', type: 'optical_wrist' }); // prior 0.65 < 0.8
    const now = Date.now();
    fusion.pushReading({ sourceId: 'wrist', hr: 70, timestamp: now });
    // Should be filtered out due to low quality
    expect(fusion.getFused(now)).toBeNull();
  });
});
