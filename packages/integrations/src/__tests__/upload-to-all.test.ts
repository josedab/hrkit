import type { Session } from '@hrkit/core';
import { SESSION_SCHEMA_VERSION } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { type SessionUploader, type UploadResult, uploadToAll } from '../providers/index.js';

const fakeSession: Session = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  startTime: 0,
  endTime: 1000,
  samples: [],
  rrIntervals: [],
  rounds: [],
  config: { hrZones: { z1: 100, z2: 120, z3: 140, z4: 160, z5: 180, max: 200 } },
};

class CountingUploader implements SessionUploader {
  readonly name: string;
  static inFlight = 0;
  static peak = 0;
  constructor(
    name: string,
    private delayMs = 5,
  ) {
    this.name = name;
  }
  async upload(): Promise<UploadResult> {
    CountingUploader.inFlight += 1;
    CountingUploader.peak = Math.max(CountingUploader.peak, CountingUploader.inFlight);
    await new Promise((r) => setTimeout(r, this.delayMs));
    CountingUploader.inFlight -= 1;
    return { provider: this.name, status: 'uploaded' };
  }
}

describe('uploadToAll', () => {
  it('preserves uploader order in results', async () => {
    const u = ['a', 'b', 'c', 'd'].map((n) => new CountingUploader(n));
    const results = await uploadToAll(u, fakeSession);
    expect(results.map((r) => r.provider)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('respects concurrency cap', async () => {
    CountingUploader.inFlight = 0;
    CountingUploader.peak = 0;
    const u = Array.from({ length: 6 }, (_, i) => new CountingUploader(`p${i}`, 10));
    const results = await uploadToAll(u, fakeSession, { concurrency: 2 });
    expect(results).toHaveLength(6);
    expect(CountingUploader.peak).toBeLessThanOrEqual(2);
  });
});
