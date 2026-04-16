import { describe, expect, it } from 'vitest';
import { RealtimeArtifactDetector } from '../realtime-artifacts.js';

describe('RealtimeArtifactDetector', () => {
  it('does not flag clean data', () => {
    const detector = new RealtimeArtifactDetector();
    const events: boolean[] = [];
    detector.artifacts$.subscribe((e) => events.push(e.isArtifact));

    const clean = [800, 810, 790, 820, 805, 815, 795];
    for (let i = 0; i < clean.length; i++) {
      detector.ingest(clean[i]!, i * 1000);
    }

    // After warmup (first 2 samples), no artifacts expected
    const afterWarmup = events.slice(3);
    expect(afterWarmup.every((a) => a === false)).toBe(true);
  });

  it('flags artifacts in noisy data', () => {
    const detector = new RealtimeArtifactDetector();
    const events: { rr: number; isArtifact: boolean }[] = [];
    detector.artifacts$.subscribe((e) => events.push({ rr: e.rr, isArtifact: e.isArtifact }));

    // Feed clean then artifact
    const data = [800, 810, 790, 820, 1500]; // 1500 is artifact
    for (let i = 0; i < data.length; i++) {
      detector.ingest(data[i]!, i * 1000);
    }

    const last = events[events.length - 1]!;
    expect(last.rr).toBe(1500);
    expect(last.isArtifact).toBe(true);
  });

  it('includes deviation in events', () => {
    const detector = new RealtimeArtifactDetector();
    let lastDeviation = 0;
    detector.artifacts$.subscribe((e) => {
      lastDeviation = e.deviation;
    });

    // Feed clean data
    detector.ingest(800, 0);
    detector.ingest(810, 1000);
    detector.ingest(790, 2000);
    detector.ingest(820, 3000);

    // Clean data has low deviation
    expect(lastDeviation).toBeLessThan(0.1);

    // Feed artifact
    detector.ingest(1500, 4000);
    expect(lastDeviation).toBeGreaterThan(0.5);
  });

  it('respects custom threshold', () => {
    const strict = new RealtimeArtifactDetector(5, 0.05); // 5% threshold
    const lenient = new RealtimeArtifactDetector(5, 0.5); // 50% threshold

    let strictArtifact = false;
    let lenientArtifact = false;
    strict.artifacts$.subscribe((e) => {
      strictArtifact = e.isArtifact;
    });
    lenient.artifacts$.subscribe((e) => {
      lenientArtifact = e.isArtifact;
    });

    // Moderate deviation: 10% off
    const data = [800, 810, 790, 820, 880]; // 880 is ~10% above mean
    for (let i = 0; i < data.length; i++) {
      strict.ingest(data[i]!, i * 1000);
      lenient.ingest(data[i]!, i * 1000);
    }

    expect(strictArtifact).toBe(true); // 10% > 5% threshold
    expect(lenientArtifact).toBe(false); // 10% < 50% threshold
  });

  it('reset clears the buffer', () => {
    const detector = new RealtimeArtifactDetector();
    detector.ingest(800, 0);
    detector.ingest(810, 1000);
    detector.ingest(790, 2000);

    detector.reset();

    const events: boolean[] = [];
    detector.artifacts$.subscribe((e) => events.push(e.isArtifact));
    detector.ingest(800, 3000); // first after reset, always clean
    expect(events[events.length - 1]).toBe(false);
  });

  it('handles first few samples gracefully', () => {
    const detector = new RealtimeArtifactDetector();
    const events: boolean[] = [];
    detector.artifacts$.subscribe((e) => events.push(e.isArtifact));

    detector.ingest(800, 0); // < 3 samples, always clean
    detector.ingest(810, 1000);
    expect(events.every((a) => a === false)).toBe(true);
  });
});
