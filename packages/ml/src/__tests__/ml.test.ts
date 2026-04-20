import { describe, expect, it } from 'vitest';
import { fatigueBaseline, type InferencePort, lactateThresholdBaseline, ModelRegistry } from '../index.js';

describe('ModelRegistry', () => {
  it('registers, looks up by id, and lists cards', () => {
    const r = new ModelRegistry();
    r.register(lactateThresholdBaseline);
    r.register(fatigueBaseline);
    expect(r.size).toBe(2);
    expect(r.get('lactate-threshold-baseline')?.modelId).toBe('lactate-threshold-baseline');
    expect(
      r
        .cardList()
        .map((c) => c.modelId)
        .sort(),
    ).toEqual(['fatigue-baseline', 'lactate-threshold-baseline']);
  });

  it('rejects double-registration of the same model@version', () => {
    const r = new ModelRegistry();
    r.register(lactateThresholdBaseline);
    expect(() => r.register(lactateThresholdBaseline)).toThrow(/already registered/);
  });

  it('returns the highest semver when multiple versions are registered', () => {
    const r = new ModelRegistry();
    r.register({ ...lactateThresholdBaseline, version: '1.0.0' });
    r.register({ ...lactateThresholdBaseline, version: '1.10.0' });
    r.register({ ...lactateThresholdBaseline, version: '2.0.0' });
    expect(r.get('lactate-threshold-baseline')?.version).toBe('2.0.0');
    expect(r.get('lactate-threshold-baseline', '1.10.0')?.version).toBe('1.10.0');
  });

  it('returns undefined for unknown models', () => {
    const r = new ModelRegistry();
    expect(r.get('nope')).toBeUndefined();
    expect(r.get('nope', '9.9.9')).toBeUndefined();
  });

  it('defaults intendedUse to "research" when not set', () => {
    const stub: InferencePort<unknown, unknown> = {
      modelId: 'stub',
      version: '0.0.1',
      modalities: ['hr'],
      async predict() {
        return null;
      },
    };
    const r = new ModelRegistry();
    r.register(stub);
    expect(r.cardList()[0]?.intendedUse).toBe('research');
  });
});

describe('lactateThresholdBaseline', () => {
  it('returns no estimate when sample count is too low', async () => {
    const out = await lactateThresholdBaseline.predict({
      samples: [
        { powerWatts: 100, hr: 110 },
        { powerWatts: 150, hr: 130 },
      ],
    });
    expect(out.confident).toBe(false);
    expect(out.ltWatts).toBe(0);
  });

  it('finds a deflection point on a synthetic two-segment HR/power curve', async () => {
    const samples = [
      { powerWatts: 100, hr: 100 },
      { powerWatts: 130, hr: 112 },
      { powerWatts: 160, hr: 124 },
      { powerWatts: 190, hr: 136 },
      { powerWatts: 220, hr: 148 },
      { powerWatts: 250, hr: 160 },
      { powerWatts: 280, hr: 178 },
      { powerWatts: 310, hr: 188 },
      { powerWatts: 340, hr: 196 },
      { powerWatts: 370, hr: 198 },
      { powerWatts: 400, hr: 200 },
      { powerWatts: 430, hr: 200 },
    ];
    const out = await lactateThresholdBaseline.predict({ samples });
    expect(out.ltWatts).toBeGreaterThanOrEqual(220);
    expect(out.ltWatts).toBeLessThanOrEqual(280);
    expect(out.rSquared).toBeGreaterThan(0.9);
    expect(out.confident).toBe(true);
  });
});

describe('fatigueBaseline', () => {
  it('returns "fresh" when rMSSD and resting HR are stable', async () => {
    const out = await fatigueBaseline.predict({
      rmssdSeries: [55, 56, 54, 55, 56, 55, 56],
      restingHrSeries: [50, 50, 51, 50, 50, 51, 50],
    });
    expect(out.band).toBe('fresh');
    expect(out.score).toBeLessThan(0.2);
  });

  it('returns "fatigued" or higher when rMSSD drops sharply', async () => {
    const out = await fatigueBaseline.predict({
      rmssdSeries: [60, 58, 55, 50, 42, 35, 30],
      restingHrSeries: [50, 51, 52, 54, 56, 58, 60],
    });
    expect(['fatigued', 'high']).toContain(out.band);
    expect(out.score).toBeGreaterThan(0.5);
    expect(out.notes).toContain('rMSSD trending down');
  });

  it('handles insufficient history gracefully', async () => {
    const out = await fatigueBaseline.predict({
      rmssdSeries: [55, 56],
      restingHrSeries: [50, 51],
    });
    expect(out.score).toBe(0);
    expect(out.band).toBe('fresh');
  });
});
