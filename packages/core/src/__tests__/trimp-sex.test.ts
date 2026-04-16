import { describe, expect, it } from 'vitest';
import { trimp, weeklyTRIMP } from '../trimp.js';
import type { Session, TimestampedHR } from '../types.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';

describe('weeklyTRIMP — sex parameter', () => {
  const weekStart = new Date('2024-01-01');

  function makeSamples(startMs: number, count: number, hr: number): TimestampedHR[] {
    const samples: TimestampedHR[] = [];
    for (let i = 0; i <= count; i++) {
      samples.push({ timestamp: startMs + i * 1000, hr });
    }
    return samples;
  }

  function makeSession(sex?: 'male' | 'female' | 'neutral'): Session {
    const startMs = weekStart.getTime();
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startTime: startMs,
      endTime: startMs + 60000,
      samples: makeSamples(startMs, 60, 150),
      rrIntervals: [],
      rounds: [],
      config: { maxHR: 185, restHR: 48, sex },
    };
  }

  it('uses session config sex when available', () => {
    const maleSessions = [makeSession('male')];
    const femaleSessions = [makeSession('female')];

    const maleTRIMP = weeklyTRIMP(maleSessions, weekStart);
    const femaleTRIMP = weeklyTRIMP(femaleSessions, weekStart);

    expect(maleTRIMP).toBeGreaterThan(femaleTRIMP);
  });

  it('falls back to defaultSex parameter', () => {
    const sessions = [makeSession()]; // no sex in config

    const maleTRIMP = weeklyTRIMP(sessions, weekStart, 'male');
    const femaleTRIMP = weeklyTRIMP(sessions, weekStart, 'female');

    expect(maleTRIMP).toBeGreaterThan(femaleTRIMP);
  });

  it('defaults to neutral when no sex specified anywhere', () => {
    const sessions = [makeSession()]; // no sex in config, no defaultSex

    const result = weeklyTRIMP(sessions, weekStart);
    // Compute expected with neutral
    const neutralConfig = { maxHR: 185, restHR: 48, sex: 'neutral' as const };
    const expected = trimp(sessions[0]!.samples, neutralConfig);

    expect(result).toBeCloseTo(expected, 10);
  });

  it('session config sex takes precedence over defaultSex', () => {
    const sessions = [makeSession('male')];

    // Even if defaultSex is female, session config says male
    const result = weeklyTRIMP(sessions, weekStart, 'female');
    const maleConfig = { maxHR: 185, restHR: 48, sex: 'male' as const };
    const expected = trimp(sessions[0]!.samples, maleConfig);

    expect(result).toBeCloseTo(expected, 10);
  });
});
