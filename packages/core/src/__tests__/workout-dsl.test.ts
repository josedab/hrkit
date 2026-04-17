import { describe, expect, it, vi } from 'vitest';
import {
  BJJ_ROUNDS,
  MAF_45,
  NORWEGIAN_4X4,
  PROTOCOL_LIBRARY,
  parseDuration,
  parseWorkoutDSL,
  TABATA,
  WorkoutCues,
  workoutToDSL,
} from '../workout-dsl.js';

describe('parseDuration', () => {
  it('parses bare number as seconds', () => {
    expect(parseDuration('90')).toBe(90);
  });
  it('parses seconds', () => {
    expect(parseDuration('45s')).toBe(45);
  });
  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300);
  });
  it('parses hours+minutes', () => {
    expect(parseDuration('1h30m')).toBe(5400);
  });
  it('throws on invalid', () => {
    expect(() => parseDuration('foobar')).toThrow();
  });
});

describe('parseWorkoutDSL', () => {
  it('parses a flat protocol', () => {
    const p = parseWorkoutDSL(`
      name: Easy Run
      warmup 5m @zone 2
      work 30m @zone 3
      cooldown 5m @zone 1
    `);
    expect(p.name).toBe('Easy Run');
    expect(p.steps).toHaveLength(3);
    expect(p.steps[0]?.target?.zone).toBe(2);
    expect(p.steps[1]?.durationSec).toBe(1800);
  });

  it('expands a repeat block', () => {
    const p = parseWorkoutDSL(`
      name: Tabata-ish
      repeat 4
        work 20s @zone 5
        rest 10s @zone 1
      end
    `);
    expect(p.steps).toHaveLength(8);
    expect(p.steps[0]?.type).toBe('work');
    expect(p.steps[1]?.type).toBe('rest');
  });

  it('parses HR range targets', () => {
    const p = parseWorkoutDSL(`
      name: T
      work 60s @hr 140-160
    `);
    expect(p.steps[0]?.target?.hrRange).toEqual([140, 160]);
  });

  it('strips comments', () => {
    const p = parseWorkoutDSL(`
      # this is a header
      name: With Comments
      work 30s @zone 4 # comment after
    `);
    expect(p.name).toBe('With Comments');
    expect(p.steps).toHaveLength(1);
  });

  it('throws on unknown directive', () => {
    expect(() => parseWorkoutDSL('name: x\nfoo 30s')).toThrow(/unknown/);
  });

  it('throws on unterminated repeat', () => {
    expect(() =>
      parseWorkoutDSL(`
        name: bad
        repeat 2
          work 30s
      `),
    ).toThrow(/unterminated/);
  });
});

describe('workoutToDSL round-trip', () => {
  it('serialises and re-parses to equivalent steps', () => {
    const p = parseWorkoutDSL(`
      name: RoundTrip
      warmup 300s @zone 2
      work 60s @zone 5
    `);
    const text = workoutToDSL(p);
    const p2 = parseWorkoutDSL(text);
    expect(p2.steps).toHaveLength(p.steps.length);
    expect(p2.steps[0]?.target?.zone).toBe(2);
  });
});

describe('PROTOCOL_LIBRARY', () => {
  it('exports the expected protocols', () => {
    expect(PROTOCOL_LIBRARY.Tabata).toBe(TABATA);
    expect(PROTOCOL_LIBRARY['MAF 45']).toBe(MAF_45);
    expect(PROTOCOL_LIBRARY['Norwegian 4x4']).toBe(NORWEGIAN_4X4);
    expect(PROTOCOL_LIBRARY['BJJ Rounds']).toBe(BJJ_ROUNDS);
  });
  it('Tabata expands to 8 work + 8 rest plus warmup/cooldown', () => {
    const types = TABATA.steps.map((s) => s.type);
    expect(types.filter((t) => t === 'work')).toHaveLength(8);
    expect(types.filter((t) => t === 'rest')).toHaveLength(8);
  });
  it('Norwegian 4x4 has four 4-minute work intervals', () => {
    const work = NORWEGIAN_4X4.steps.filter((s) => s.type === 'work');
    expect(work).toHaveLength(4);
    expect(work[0]?.durationSec).toBe(240);
  });
});

describe('WorkoutCues', () => {
  function makeSpeaker() {
    const spoken: string[] = [];
    return {
      spoken,
      speak: vi.fn((t: string) => {
        spoken.push(t);
      }),
    };
  }

  it('announces a new step with target zone', () => {
    const sp = makeSpeaker();
    const cues = new WorkoutCues(sp);
    cues.announceStep({ name: 'Work', type: 'work', durationSec: 240, target: { zone: 5 } }, 0);
    expect(sp.spoken[0]).toContain('Work');
    expect(sp.spoken[0]).toContain('zone 5');
    expect(sp.spoken[0]).toContain('4 minutes');
  });

  it('announces HR range target', () => {
    const sp = makeSpeaker();
    const cues = new WorkoutCues(sp);
    cues.announceStep({ name: 'Work', type: 'work', durationSec: 30, target: { hrRange: [140, 160] } }, 0);
    expect(sp.spoken[0]).toMatch(/140 to 160/);
  });

  it('counts down 3-2-1 once each', () => {
    const sp = makeSpeaker();
    const cues = new WorkoutCues(sp);
    cues.tick(5, 0); // not in countdown
    cues.tick(3, 0);
    cues.tick(3, 0); // duplicate ignored
    cues.tick(2, 0);
    cues.tick(1, 0);
    expect(sp.spoken).toEqual(['3', '2', '1']);
  });
});
