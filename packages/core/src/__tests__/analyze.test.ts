import { describe, expect, it } from 'vitest';
import { analyzeSession } from '../analyze.js';
import type { Session, TimestampedHR } from '../types.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';

function makeSession(overrides?: Partial<Session>): Session {
  const samples: TimestampedHR[] = [];
  for (let i = 0; i <= 60; i++) {
    samples.push({ timestamp: i * 1000, hr: 120 + Math.sin(i / 5) * 30 });
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime: 0,
    endTime: 60000,
    samples,
    rrIntervals: [800, 810, 790, 820, 805, 815, 795, 810, 800, 820, 790, 805],
    rounds: [],
    config: { maxHR: 185, restHR: 48 },
    ...overrides,
  };
}

describe('analyzeSession', () => {
  it('computes all metrics for a normal session', () => {
    const session = makeSession();
    const analysis = analyzeSession(session);

    expect(analysis.durationSec).toBe(60);
    expect(analysis.sampleCount).toBe(61);
    expect(analysis.rrCount).toBe(12);
    expect(analysis.roundCount).toBe(0);

    // HR stats
    expect(analysis.hr.mean).toBeGreaterThan(0);
    expect(analysis.hr.min).toBeGreaterThan(0);
    expect(analysis.hr.max).toBeGreaterThanOrEqual(analysis.hr.min);

    // HRV
    expect(analysis.hrv).not.toBeNull();
    expect(analysis.hrv!.rmssd).toBeGreaterThan(0);
    expect(analysis.hrv!.sdnn).toBeGreaterThan(0);
    expect(analysis.hrv!.pnn50).toBeGreaterThanOrEqual(0);

    // Artifacts
    expect(analysis.artifacts).not.toBeNull();
    expect(analysis.artifacts!.artifactRate).toBeGreaterThanOrEqual(0);

    // Zones
    expect(analysis.zones.total).toBeGreaterThan(0);

    // TRIMP
    expect(analysis.trimp).toBeGreaterThan(0);
  });

  it('returns null HRV when no RR intervals', () => {
    const session = makeSession({ rrIntervals: [] });
    const analysis = analyzeSession(session);

    expect(analysis.hrv).toBeNull();
    expect(analysis.artifacts).toBeNull();
    expect(analysis.hr.meanFromRR).toBeNull();
  });

  it('returns null HRV with only 1 RR interval', () => {
    const session = makeSession({ rrIntervals: [800] });
    const analysis = analyzeSession(session);

    expect(analysis.hrv).toBeNull();
    expect(analysis.artifacts).toBeNull();
  });

  it('computes meanFromRR when RR data available', () => {
    const session = makeSession();
    const analysis = analyzeSession(session);

    expect(analysis.hr.meanFromRR).not.toBeNull();
    expect(analysis.hr.meanFromRR).toBeGreaterThan(0);
  });

  it('handles empty session', () => {
    const session = makeSession({
      samples: [],
      rrIntervals: [],
    });
    const analysis = analyzeSession(session);

    expect(analysis.durationSec).toBe(0);
    expect(analysis.sampleCount).toBe(0);
    expect(analysis.hr.mean).toBe(0);
    expect(analysis.hr.min).toBe(0);
    expect(analysis.hr.max).toBe(0);
    expect(analysis.trimp).toBe(0);
  });

  it('handles single-sample session', () => {
    const session = makeSession({
      samples: [{ timestamp: 1000, hr: 72 }],
      rrIntervals: [],
    });
    const analysis = analyzeSession(session);

    expect(analysis.durationSec).toBe(0);
    expect(analysis.sampleCount).toBe(1);
    expect(analysis.hr.mean).toBe(72);
    expect(analysis.hr.min).toBe(72);
    expect(analysis.hr.max).toBe(72);
  });

  it('counts rounds', () => {
    const session = makeSession({
      rounds: [
        { index: 0, startTime: 0, endTime: 30000, samples: [], rrIntervals: [] },
        { index: 1, startTime: 30000, endTime: 60000, samples: [], rrIntervals: [] },
      ],
    });
    const analysis = analyzeSession(session);

    expect(analysis.roundCount).toBe(2);
  });

  it('uses session config for zone thresholds', () => {
    const session = makeSession({
      config: { maxHR: 200, restHR: 40, zones: [0.5, 0.6, 0.7, 0.8] },
    });
    const analysis = analyzeSession(session);

    expect(analysis.zones.total).toBeGreaterThan(0);
  });

  it('uses session config sex for TRIMP', () => {
    const sessionMale = makeSession({ config: { maxHR: 185, restHR: 48, sex: 'male' } });
    const sessionFemale = makeSession({ config: { maxHR: 185, restHR: 48, sex: 'female' } });

    const analysisMale = analyzeSession(sessionMale);
    const analysisFemale = analyzeSession(sessionFemale);

    // Male has higher sex factor → higher TRIMP
    expect(analysisMale.trimp).toBeGreaterThan(analysisFemale.trimp);
  });

  it('filters artifacts before computing HRV', () => {
    // Session with artifact in RR data
    const session = makeSession({
      rrIntervals: [800, 810, 1500, 790, 820, 805, 815, 795, 810, 800, 820, 790],
    });
    const analysis = analyzeSession(session);

    expect(analysis.artifacts).not.toBeNull();
    expect(analysis.artifacts!.artifactRate).toBeGreaterThan(0);
    expect(analysis.hrv).not.toBeNull();
  });
});
