import { describe, expect, it } from 'vitest';
import { RollingRMSSD, TRIMPAccumulator } from '../windowed-metrics.js';

describe('RollingRMSSD', () => {
  it('does not emit until minSamples reached', () => {
    const calc = new RollingRMSSD(30, 5);
    const values: number[] = [];
    calc.rmssd$.subscribe((v) => values.push(v.rmssd));

    calc.ingest([800, 810, 790], 1000); // only 3, need 5
    expect(values).toHaveLength(0);

    calc.ingest([820, 805], 2000); // now 5
    expect(values).toHaveLength(1);
    expect(values[0]).toBeGreaterThan(0);
  });

  it('emits RMSSD after each ingest once min met', () => {
    const calc = new RollingRMSSD(10, 3);
    const values: number[] = [];
    calc.rmssd$.subscribe((v) => values.push(v.rmssd));

    calc.ingest([800, 810, 790], 1000);
    expect(values).toHaveLength(1);

    calc.ingest([820], 2000);
    expect(values).toHaveLength(2);
  });

  it('trims buffer to window size', () => {
    const calc = new RollingRMSSD(5, 3);
    let lastCount = 0;
    calc.rmssd$.subscribe((v) => {
      lastCount = v.sampleCount;
    });

    // Ingest 10 intervals
    for (let i = 0; i < 10; i++) {
      calc.ingest([800 + i * 5], i * 1000);
    }

    expect(lastCount).toBeLessThanOrEqual(5);
  });

  it('reset clears the buffer', () => {
    const calc = new RollingRMSSD(10, 3);
    const values: number[] = [];
    calc.rmssd$.subscribe((v) => values.push(v.rmssd));

    calc.ingest([800, 810, 790, 820], 1000);
    expect(values).toHaveLength(1);

    calc.reset();
    values.length = 0;

    calc.ingest([800, 810], 2000); // only 2, need 3
    expect(values).toHaveLength(0);
  });

  it('includes timestamp in output', () => {
    const calc = new RollingRMSSD(10, 2);
    let ts = 0;
    calc.rmssd$.subscribe((v) => {
      ts = v.timestamp;
    });

    calc.ingest([800, 810], 5000);
    expect(ts).toBe(5000);
  });
});

describe('TRIMPAccumulator', () => {
  const config = { maxHR: 185, restHR: 48, sex: 'male' as const };

  it('starts at zero TRIMP', () => {
    const acc = new TRIMPAccumulator(config);
    let value = -1;
    acc.trimp$.subscribe((v) => {
      value = v.trimp;
    });

    acc.ingest(72, 0); // first sample has no delta
    expect(value).toBe(0);
  });

  it('accumulates TRIMP over time', () => {
    const acc = new TRIMPAccumulator(config);
    const values: number[] = [];
    acc.trimp$.subscribe((v) => values.push(v.trimp));

    for (let i = 0; i <= 60; i++) {
      acc.ingest(150, i * 1000);
    }

    expect(values.length).toBe(61);
    expect(values[values.length - 1]).toBeGreaterThan(0);
  });

  it('higher HR produces higher TRIMP rate', () => {
    const accLow = new TRIMPAccumulator(config);
    const accHigh = new TRIMPAccumulator(config);
    let lowTrimp = 0;
    let highTrimp = 0;
    accLow.trimp$.subscribe((v) => {
      lowTrimp = v.trimp;
    });
    accHigh.trimp$.subscribe((v) => {
      highTrimp = v.trimp;
    });

    for (let i = 0; i <= 60; i++) {
      accLow.ingest(100, i * 1000);
      accHigh.ingest(170, i * 1000);
    }

    expect(highTrimp).toBeGreaterThan(lowTrimp);
  });

  it('skips gaps > 30s', () => {
    const acc = new TRIMPAccumulator(config);
    let trimp = 0;
    acc.trimp$.subscribe((v) => {
      trimp = v.trimp;
    });

    acc.ingest(150, 0);
    acc.ingest(150, 1000); // 1s gap — counted
    const trimpAfter1 = trimp;

    acc.ingest(150, 61000); // 60s gap — skipped
    expect(trimp).toBe(trimpAfter1);

    acc.ingest(150, 62000); // 1s gap — counted
    expect(trimp).toBeGreaterThan(trimpAfter1);
  });

  it('reset clears accumulation', () => {
    const acc = new TRIMPAccumulator(config);
    let trimp = 0;
    acc.trimp$.subscribe((v) => {
      trimp = v.trimp;
    });

    acc.ingest(150, 0);
    acc.ingest(150, 1000);
    expect(trimp).toBeGreaterThan(0);

    acc.reset();
    acc.ingest(150, 10000);
    expect(trimp).toBe(0); // first sample after reset, no delta
  });
});
