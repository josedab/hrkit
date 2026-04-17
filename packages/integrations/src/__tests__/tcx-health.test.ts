import type { Session } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { MemoryHealthStore, sessionToHealthRecords, sessionToTCX } from '../index.js';

const session: Session = {
  startTime: Date.UTC(2024, 0, 1, 10, 0, 0),
  endTime: Date.UTC(2024, 0, 1, 10, 0, 5),
  duration: 5000,
  samples: [
    { timestamp: Date.UTC(2024, 0, 1, 10, 0, 0), hr: 70, rrIntervals: [857] },
    { timestamp: Date.UTC(2024, 0, 1, 10, 0, 1), hr: 80, rrIntervals: [750] },
    { timestamp: Date.UTC(2024, 0, 1, 10, 0, 2), hr: 90, rrIntervals: [667] },
  ],
} as Session;

describe('sessionToTCX', () => {
  it('produces a valid-looking TCX document', () => {
    const xml = sessionToTCX(session, { sport: 'Running' });
    expect(xml).toContain('<TrainingCenterDatabase');
    expect(xml).toContain('Sport="Running"');
    expect(xml).toContain('<HeartRateBpm><Value>70</Value></HeartRateBpm>');
    expect(xml).toContain('<HeartRateBpm><Value>90</Value></HeartRateBpm>');
    expect(xml).toContain('<AverageHeartRateBpm><Value>80</Value></AverageHeartRateBpm>');
    expect(xml).toContain('<MaximumHeartRateBpm><Value>90</Value></MaximumHeartRateBpm>');
  });

  it('escapes XML in the activity id', () => {
    const xml = sessionToTCX(session, { activityId: '<script>&"' });
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });
});

describe('sessionToHealthRecords', () => {
  it('emits a workout record + per-sample HR records', () => {
    const records = sessionToHealthRecords(session, { activityType: 'martialArts' });
    expect(records[0]?.type).toBe('workout');
    if (records[0]?.type === 'workout') {
      expect(records[0].activityType).toBe('martialArts');
    }
    const hr = records.filter((r) => r.type === 'heartRate');
    expect(hr.length).toBe(3);
  });

  it('omits HR records when includeHrSamples=false', () => {
    const records = sessionToHealthRecords(session, { includeHrSamples: false });
    expect(records.length).toBe(1);
  });
});

describe('MemoryHealthStore', () => {
  it('requires authorization before saving', async () => {
    const store = new MemoryHealthStore();
    await expect(store.save([])).rejects.toThrow(/not authorized/);
    await store.requestAuthorization(['heartRate', 'workout']);
    const r = await store.save([{ type: 'heartRate', startMs: 0, endMs: 1000, bpm: 60 }]);
    expect(r.saved).toBe(1);
    expect(store.records.length).toBe(1);
  });
});
