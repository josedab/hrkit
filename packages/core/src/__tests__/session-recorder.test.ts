import { describe, it, expect } from 'vitest';
import { SessionRecorder } from '../session-recorder.js';
import type { HRPacket } from '../types.js';

describe('SessionRecorder', () => {
  const config = { maxHR: 185, restHR: 48 };

  function makePacket(timestamp: number, hr: number, rrIntervals: number[] = []): HRPacket {
    return { timestamp, hr, rrIntervals, contactDetected: true };
  }

  it('records HR samples from ingested packets', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72, [833]));
    recorder.ingest(makePacket(2000, 80, [750]));

    const session = recorder.end();
    expect(session.samples).toHaveLength(2);
    expect(session.samples[0]!.hr).toBe(72);
    expect(session.samples[1]!.hr).toBe(80);
    expect(session.rrIntervals).toEqual([833, 750]);
  });

  it('tracks current HR and zone', () => {
    const recorder = new SessionRecorder(config);

    expect(recorder.currentHR()).toBeNull();
    expect(recorder.currentZone()).toBeNull();

    recorder.ingest(makePacket(1000, 100));
    expect(recorder.currentHR()).toBe(100);
    expect(recorder.currentZone()).toBe(1); // 100/185 = 54%

    recorder.ingest(makePacket(2000, 170));
    expect(recorder.currentHR()).toBe(170);
    expect(recorder.currentZone()).toBe(5); // 170/185 = 91.9%
  });

  it('emits values on hr$ stream', () => {
    const recorder = new SessionRecorder(config);
    const values: number[] = [];

    recorder.hr$.subscribe((hr) => values.push(hr));

    recorder.ingest(makePacket(1000, 72));
    recorder.ingest(makePacket(2000, 85));

    expect(values).toEqual([72, 85]);
  });

  it('emits current value on late subscribe (BehaviorSubject semantics)', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72));

    const values: number[] = [];
    recorder.hr$.subscribe((hr) => values.push(hr));

    expect(values).toEqual([72]); // should get current value immediately
  });

  it('supports unsubscribe', () => {
    const recorder = new SessionRecorder(config);
    const values: number[] = [];

    const unsub = recorder.hr$.subscribe((hr) => values.push(hr));

    recorder.ingest(makePacket(1000, 72));
    unsub();
    recorder.ingest(makePacket(2000, 85));

    expect(values).toEqual([72]); // 85 should not appear
  });

  it('manages rounds', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72));
    recorder.startRound({ label: 'Round 1' });

    recorder.ingest(makePacket(2000, 120));
    recorder.ingest(makePacket(3000, 140));

    const round = recorder.endRound();

    expect(round.index).toBe(0);
    expect(round.samples).toHaveLength(2);
    expect(round.meta?.label).toBe('Round 1');
  });

  it('throws when ending round with no round in progress', () => {
    const recorder = new SessionRecorder(config);
    expect(() => recorder.endRound()).toThrow('No round in progress');
  });

  it('tracks multiple rounds', () => {
    const recorder = new SessionRecorder(config);

    recorder.startRound();
    recorder.ingest(makePacket(1000, 120));
    recorder.endRound();

    recorder.startRound();
    recorder.ingest(makePacket(2000, 150));
    recorder.endRound();

    const session = recorder.end();
    expect(session.rounds).toHaveLength(2);
    expect(session.rounds[0]!.index).toBe(0);
    expect(session.rounds[1]!.index).toBe(1);
  });

  it('returns complete session on end()', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72, [833]));
    recorder.ingest(makePacket(2000, 80, [750]));

    const session = recorder.end();

    expect(session.schemaVersion).toBe(1);
    expect(session.startTime).toBe(1000);
    expect(session.endTime).toBe(2000);
    expect(session.samples).toHaveLength(2);
    expect(session.rrIntervals).toEqual([833, 750]);
    expect(session.config).toEqual(config);
  });

  it('uses custom zone thresholds', () => {
    const customConfig = { maxHR: 200, zones: [0.5, 0.6, 0.7, 0.8] as [number, number, number, number] };
    const recorder = new SessionRecorder(customConfig);

    recorder.ingest(makePacket(1000, 170)); // 170/200 = 85% → zone 5 with these thresholds
    expect(recorder.currentZone()).toBe(5);
  });
});
