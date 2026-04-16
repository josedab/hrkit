import { describe, it, expect } from 'vitest';
import { InMemoryAthleteStore } from '../athlete-store.js';
import type { Session, SessionConfig } from '../types.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';

function makeSession(
  overrides: Partial<{
    startTime: number;
    endTime: number;
    hrs: number[];
    rrIntervals: number[];
    config: SessionConfig;
    metadata: Record<string, unknown>;
    rounds: Session['rounds'];
  }> = {},
): Session {
  const startTime = overrides.startTime ?? Date.now() - 60_000;
  const endTime = overrides.endTime ?? startTime + 60_000;
  const hrs = overrides.hrs ?? [120, 130, 140, 150, 160];
  const intervalMs = hrs.length > 1 ? (endTime - startTime) / (hrs.length - 1) : 0;
  const samples = hrs.map((hr, i) => ({
    timestamp: startTime + i * intervalMs,
    hr,
  }));

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime,
    endTime,
    samples,
    rrIntervals: overrides.rrIntervals ?? [],
    rounds: overrides.rounds ?? [],
    config: overrides.config ?? { maxHR: 185, restHR: 48 },
    metadata: overrides.metadata,
  };
}

describe('InMemoryAthleteStore', () => {
  describe('saveSession', () => {
    it('returns a unique ID', () => {
      const store = new InMemoryAthleteStore();
      const id1 = store.saveSession(makeSession());
      const id2 = store.saveSession(makeSession());
      expect(id1).toMatch(/^session-/);
      expect(id2).toMatch(/^session-/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('getSessions', () => {
    it('returns summaries ordered by startTime descending', () => {
      const store = new InMemoryAthleteStore();
      const base = Date.now();
      store.saveSession(makeSession({ startTime: base - 30_000, endTime: base - 20_000 }));
      store.saveSession(makeSession({ startTime: base - 10_000, endTime: base }));
      store.saveSession(makeSession({ startTime: base - 20_000, endTime: base - 15_000 }));

      const sessions = store.getSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions[0]!.startTime).toBeGreaterThan(sessions[1]!.startTime);
      expect(sessions[1]!.startTime).toBeGreaterThan(sessions[2]!.startTime);
    });

    it('respects limit parameter', () => {
      const store = new InMemoryAthleteStore();
      store.saveSession(makeSession());
      store.saveSession(makeSession());
      store.saveSession(makeSession());

      expect(store.getSessions(2)).toHaveLength(2);
    });
  });

  describe('getSession', () => {
    it('returns a specific summary by ID', () => {
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(makeSession());
      const summary = store.getSession(id);
      expect(summary).toBeDefined();
      expect(summary!.id).toBe(id);
    });

    it('returns undefined for unknown ID', () => {
      const store = new InMemoryAthleteStore();
      expect(store.getSession('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('removes session and returns true', () => {
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(makeSession());
      expect(store.deleteSession(id)).toBe(true);
      expect(store.getSession(id)).toBeUndefined();
    });

    it('returns false for missing ID', () => {
      const store = new InMemoryAthleteStore();
      expect(store.deleteSession('nonexistent')).toBe(false);
    });
  });

  describe('getSessionCount', () => {
    it('returns accurate count', () => {
      const store = new InMemoryAthleteStore();
      expect(store.getSessionCount()).toBe(0);
      store.saveSession(makeSession());
      expect(store.getSessionCount()).toBe(1);
      store.saveSession(makeSession());
      expect(store.getSessionCount()).toBe(2);
    });
  });

  describe('session summary computed values', () => {
    it('computes duration, meanHR, maxHR, trimp, rmssd correctly', () => {
      const startTime = Date.now() - 60_000;
      const endTime = startTime + 60_000;
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(
        makeSession({
          startTime,
          endTime,
          hrs: [120, 130, 140, 150, 160],
          rrIntervals: [800, 810, 790, 820, 805],
          config: { maxHR: 185, restHR: 48 },
        }),
      );

      const summary = store.getSession(id)!;
      expect(summary.durationSec).toBe(60);
      expect(summary.meanHR).toBe(140);
      expect(summary.maxHR).toBe(160);
      expect(summary.trimp).toBeGreaterThan(0);
      expect(summary.rmssd).toBeGreaterThan(0);
    });

    it('sets rmssd to null when no RR intervals', () => {
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(makeSession({ rrIntervals: [] }));
      expect(store.getSession(id)!.rmssd).toBeNull();
    });

    it('sets roundCount from session rounds', () => {
      const startTime = Date.now();
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(
        makeSession({
          rounds: [
            { index: 0, startTime, endTime: startTime + 30_000, samples: [], rrIntervals: [] },
            { index: 1, startTime: startTime + 30_000, endTime: startTime + 60_000, samples: [], rrIntervals: [] },
          ],
        }),
      );
      expect(store.getSession(id)!.roundCount).toBe(2);
    });

    it('extracts activityType from metadata', () => {
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(makeSession({ metadata: { activityType: 'bjj' } }));
      expect(store.getSession(id)!.activityType).toBe('bjj');
    });

    it('handles sessions with no metadata', () => {
      const store = new InMemoryAthleteStore();
      const id = store.saveSession(makeSession());
      expect(store.getSession(id)!.activityType).toBeUndefined();
    });
  });

  describe('getTrainingLoadTrend', () => {
    it('returns correct ATL/CTL/ACWR/TSB over multiple days', () => {
      const store = new InMemoryAthleteStore();
      const now = new Date();
      now.setHours(12, 0, 0, 0);

      // Add sessions across several days
      for (let d = 6; d >= 0; d--) {
        const dayStart = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        dayStart.setHours(10, 0, 0, 0);
        const startTime = dayStart.getTime();
        const endTime = startTime + 60_000;

        // Create a session with samples every second for 1 minute at 150bpm
        const hrs: number[] = [];
        for (let s = 0; s <= 60; s++) hrs.push(150);

        store.saveSession(
          makeSession({
            startTime,
            endTime,
            hrs,
            config: { maxHR: 185, restHR: 48 },
          }),
        );
      }

      const trend = store.getTrainingLoadTrend(7);
      expect(trend.length).toBe(7);

      // Each point should have defined values
      for (const point of trend) {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof point.atl).toBe('number');
        expect(typeof point.ctl).toBe('number');
        expect(typeof point.acwr).toBe('number');
        expect(typeof point.tsb).toBe('number');
      }

      // Last point should have ATL > 0 (7 days of sessions)
      const last = trend[trend.length - 1]!;
      expect(last.atl).toBeGreaterThan(0);
      // TSB = CTL - ATL
      expect(last.tsb).toBeCloseTo(last.ctl - last.atl, 5);
    });
  });

  describe('getHRVTrend', () => {
    it('returns correct rMSSD, rolling average, CV', () => {
      const store = new InMemoryAthleteStore();
      const now = new Date();
      now.setHours(12, 0, 0, 0);

      // Add sessions with RR data across several days
      for (let d = 9; d >= 0; d--) {
        const dayStart = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        dayStart.setHours(10, 0, 0, 0);
        const startTime = dayStart.getTime();
        const endTime = startTime + 60_000;

        store.saveSession(
          makeSession({
            startTime,
            endTime,
            hrs: [120, 130, 140, 150, 160],
            rrIntervals: [800, 810, 790, 820, 805],
            config: { maxHR: 185, restHR: 48 },
          }),
        );
      }

      const trend = store.getHRVTrend(10);
      expect(trend.length).toBeGreaterThan(0);

      for (const point of trend) {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(point.rmssd).toBeGreaterThan(0);
        expect(point.rollingAvg).toBeGreaterThan(0);
        expect(typeof point.cv).toBe('number');
        expect(point.cv).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getCurrentACWR', () => {
    it('returns null when no data', () => {
      const store = new InMemoryAthleteStore();
      expect(store.getCurrentACWR()).toBeNull();
    });

    it('returns correct value with data', () => {
      const store = new InMemoryAthleteStore();
      const now = new Date();
      now.setHours(10, 0, 0, 0);

      // Add a session today
      const startTime = now.getTime();
      const endTime = startTime + 60_000;
      const hrs: number[] = [];
      for (let s = 0; s <= 60; s++) hrs.push(150);

      store.saveSession(
        makeSession({
          startTime,
          endTime,
          hrs,
          config: { maxHR: 185, restHR: 48 },
        }),
      );

      const acwr = store.getCurrentACWR();
      expect(acwr).not.toBeNull();
      expect(typeof acwr).toBe('number');
    });
  });
});

describe('InMemoryAthleteStore edge cases', () => {
  it('saveSession with empty samples', () => {
    const store = new InMemoryAthleteStore();
    const session = makeSession({ hrs: [] });
    const id = store.saveSession(session);
    const summary = store.getSession(id);
    expect(summary).toBeDefined();
    expect(summary!.meanHR).toBe(0);
    expect(summary!.maxHR).toBe(0);
  });

  it('saveSession with 1 RR interval returns null rmssd', () => {
    const store = new InMemoryAthleteStore();
    const session = makeSession({ rrIntervals: [800] });
    const id = store.saveSession(session);
    expect(store.getSession(id)!.rmssd).toBeNull();
  });

  it('getTrainingLoadTrend with 0 days returns empty', () => {
    const store = new InMemoryAthleteStore();
    expect(store.getTrainingLoadTrend(0)).toEqual([]);
  });

  it('getHRVTrend with 0 days returns empty', () => {
    const store = new InMemoryAthleteStore();
    expect(store.getHRVTrend(0)).toEqual([]);
  });

  it('deleteSession then getSession returns undefined', () => {
    const store = new InMemoryAthleteStore();
    const id = store.saveSession(makeSession({}));
    store.deleteSession(id);
    expect(store.getSession(id)).toBeUndefined();
    expect(store.getSessionCount()).toBe(0);
  });
});
