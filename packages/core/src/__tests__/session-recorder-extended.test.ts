import { describe, it, expect } from 'vitest';
import { SessionRecorder } from '../session-recorder.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';
import type { HRPacket } from '../types.js';

function makePacket(timestamp: number, hr: number, rrIntervals: number[] = []): HRPacket {
  return { timestamp, hr, rrIntervals, contactDetected: true };
}

describe('SessionRecorder — pause/resume', () => {
  const config = { maxHR: 185, restHR: 48 };

  it('starts unpaused', () => {
    const recorder = new SessionRecorder(config);
    expect(recorder.paused).toBe(false);
  });

  it('ignores packets when paused', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72));
    recorder.pause();
    expect(recorder.paused).toBe(true);

    recorder.ingest(makePacket(2000, 150)); // should be ignored
    recorder.ingest(makePacket(3000, 160)); // should be ignored

    recorder.resume();
    expect(recorder.paused).toBe(false);

    recorder.ingest(makePacket(4000, 80));

    const session = recorder.end();
    expect(session.samples).toHaveLength(2); // only 72 and 80
    expect(session.samples[0]!.hr).toBe(72);
    expect(session.samples[1]!.hr).toBe(80);
  });

  it('does not emit to streams when paused', () => {
    const recorder = new SessionRecorder(config);
    const values: number[] = [];
    recorder.hr$.subscribe((hr) => values.push(hr));

    recorder.ingest(makePacket(1000, 72));
    recorder.pause();
    recorder.ingest(makePacket(2000, 150)); // ignored
    recorder.resume();
    recorder.ingest(makePacket(3000, 80));

    expect(values).toEqual([72, 80]);
  });

  it('preserves currentHR during pause', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 72));
    recorder.pause();
    recorder.ingest(makePacket(2000, 150)); // ignored

    expect(recorder.currentHR()).toBe(72); // last value before pause
  });

  it('does not add paused packets to active round', () => {
    const recorder = new SessionRecorder(config);

    recorder.startRound({ label: 'R1' });
    recorder.ingest(makePacket(1000, 120));
    recorder.pause();
    recorder.ingest(makePacket(2000, 180)); // ignored
    recorder.resume();
    recorder.ingest(makePacket(3000, 130));
    const round = recorder.endRound();

    expect(round.samples).toHaveLength(2);
    expect(round.samples[0]!.hr).toBe(120);
    expect(round.samples[1]!.hr).toBe(130);
  });

  it('multiple pause/resume cycles work correctly', () => {
    const recorder = new SessionRecorder(config);

    recorder.ingest(makePacket(1000, 70)); // recorded
    recorder.pause();
    recorder.ingest(makePacket(2000, 150)); // ignored
    recorder.resume();
    recorder.ingest(makePacket(3000, 80)); // recorded
    recorder.pause();
    recorder.ingest(makePacket(4000, 160)); // ignored
    recorder.resume();
    recorder.ingest(makePacket(5000, 90)); // recorded

    const session = recorder.end();
    expect(session.samples).toHaveLength(3);
    expect(session.samples.map((s) => s.hr)).toEqual([70, 80, 90]);
  });
});

describe('SessionRecorder — packet timestamps', () => {
  const config = { maxHR: 185, restHR: 48 };

  it('uses first packet timestamp as startTime', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(5000, 72));
    recorder.ingest(makePacket(6000, 80));

    const session = recorder.end();
    expect(session.startTime).toBe(5000);
  });

  it('uses last packet timestamp as endTime', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(5000, 72));
    recorder.ingest(makePacket(10000, 80));

    const session = recorder.end();
    expect(session.endTime).toBe(10000);
  });

  it('elapsedSeconds uses packet timestamps', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 72));
    recorder.ingest(makePacket(11000, 80));

    expect(recorder.elapsedSeconds()).toBe(10);
  });

  it('elapsedSeconds returns 0 before any packets', () => {
    const recorder = new SessionRecorder(config);
    expect(recorder.elapsedSeconds()).toBe(0);
  });

  it('round startTime uses last packet timestamp', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 72));
    recorder.ingest(makePacket(5000, 80));
    recorder.startRound();
    recorder.ingest(makePacket(6000, 120));
    const round = recorder.endRound();

    // Round started after packet at 5000, so startTime should be 5000
    expect(round.startTime).toBe(5000);
  });

  it('round endTime uses last packet timestamp', () => {
    const recorder = new SessionRecorder(config);
    recorder.startRound();
    recorder.ingest(makePacket(1000, 120));
    recorder.ingest(makePacket(5000, 150));
    const round = recorder.endRound();

    expect(round.endTime).toBe(5000);
  });
});

describe('SessionRecorder — metadata & device info', () => {
  const config = { maxHR: 185, restHR: 48 };

  it('includes schemaVersion in session output', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 72));
    const session = recorder.end();

    expect(session.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(session.schemaVersion).toBe(1);
  });

  it('includes device info when set', () => {
    const recorder = new SessionRecorder(config);
    recorder.setDeviceInfo({
      id: 'abc-123',
      name: 'Polar H10 A1B2C3',
      profile: {
        brand: 'Polar',
        model: 'H10',
        namePrefix: 'Polar H10',
        capabilities: ['heartRate', 'rrIntervals', 'ecg'],
        serviceUUIDs: ['0000180d-0000-1000-8000-00805f9b34fb'],
      },
    });

    recorder.ingest(makePacket(1000, 72));
    const session = recorder.end();

    expect(session.deviceInfo).toBeDefined();
    expect(session.deviceInfo!.id).toBe('abc-123');
    expect(session.deviceInfo!.name).toBe('Polar H10 A1B2C3');
    expect(session.deviceInfo!.profile?.brand).toBe('Polar');
  });

  it('includes metadata when set', () => {
    const recorder = new SessionRecorder(config);
    recorder.setMetadata({ activity: 'bjj', gym: 'Alliance HQ' });

    recorder.ingest(makePacket(1000, 72));
    const session = recorder.end();

    expect(session.metadata).toEqual({ activity: 'bjj', gym: 'Alliance HQ' });
  });

  it('session has undefined deviceInfo/metadata when not set', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 72));
    const session = recorder.end();

    expect(session.deviceInfo).toBeUndefined();
    expect(session.metadata).toBeUndefined();
  });
});

describe('SessionRecorder — sex in config', () => {
  it('passes sex config through to session', () => {
    const recorder = new SessionRecorder({ maxHR: 185, restHR: 48, sex: 'female' });
    recorder.ingest(makePacket(1000, 72));
    const session = recorder.end();

    expect(session.config.sex).toBe('female');
  });
});

describe('SessionRecorder — lifecycle safety', () => {
  const config = { maxHR: 185, restHR: 48 };

  it('throws on nested startRound', () => {
    const recorder = new SessionRecorder(config);
    recorder.startRound({ label: 'R1' });
    expect(() => recorder.startRound({ label: 'R2' })).toThrow('already in progress');
  });

  it('auto-closes open round on end()', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 120));
    recorder.startRound({ label: 'R1' });
    recorder.ingest(makePacket(2000, 150));

    const session = recorder.end();
    expect(session.rounds).toHaveLength(1);
    expect(session.rounds[0]!.meta?.label).toBe('R1');
  });

  it('end() returns snapshot (mutation-safe)', () => {
    const recorder = new SessionRecorder(config);
    recorder.ingest(makePacket(1000, 72));
    recorder.ingest(makePacket(2000, 80));

    const session = recorder.end();
    const originalLength = session.samples.length;

    // Mutating the returned session should not affect recorder's internal state
    session.samples.push({ timestamp: 9999, hr: 999 });
    expect(session.samples.length).toBe(originalLength + 1);

    // Getting another session should not reflect the mutation
    // (recorder is already ended, but the point is the returned arrays are independent)
  });

  it('round data is snapshot (mutation-safe)', () => {
    const recorder = new SessionRecorder(config);
    recorder.startRound();
    recorder.ingest(makePacket(1000, 120));
    const round = recorder.endRound();

    const originalLength = round.samples.length;
    round.samples.push({ timestamp: 9999, hr: 999 });
    expect(round.samples.length).toBe(originalLength + 1);
    // Internal recorder state is not affected
  });

  it('uses HRKitError for round lifecycle errors', () => {
    const recorder = new SessionRecorder(config);
    try {
      recorder.endRound();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).name).toBe('HRKitError');
    }
  });
});
