import { describe, it, expect } from 'vitest';
import type { HRPacket, HRZoneConfig } from '../types.js';
import type { StepChangeEvent, TargetEvent, WorkoutState } from '../workout-protocol.js';
import {
  WorkoutEngine,
  tabataProtocol,
  emomProtocol,
  pyramidProtocol,
  bjjRoundsProtocol,
  intervalProtocol,
} from '../workout-protocol.js';

const zoneConfig: HRZoneConfig = {
  maxHR: 200,
  restHR: 60,
  zones: [0.6, 0.7, 0.8, 0.9],
};

function makePacket(timestamp: number, hr: number): HRPacket {
  return { timestamp, hr, rrIntervals: [], contactDetected: true };
}

describe('WorkoutEngine', () => {
  describe('constructor & step expansion', () => {
    it('expands steps with repeat > 1', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 30, repeat: 3 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      expect(engine.getExpandedSteps()).toHaveLength(3);
      expect(engine.getExpandedSteps().every((s) => s.name === 'Work')).toBe(true);
      expect(engine.getExpandedSteps().every((s) => s.repeat === undefined)).toBe(true);
    });

    it('does not expand steps with repeat 1 or undefined', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'A', type: 'work' as const, durationSec: 10, repeat: 1 },
          { name: 'B', type: 'rest' as const, durationSec: 10 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      expect(engine.getExpandedSteps()).toHaveLength(2);
    });

    it('throws on negative step duration', () => {
      expect(() => new WorkoutEngine(
        { name: 'Bad', steps: [{ name: 'Bad', type: 'work' as const, durationSec: -5 }] },
        zoneConfig,
      )).toThrow('negative duration');
    });
  });

  describe('start()', () => {
    it('sets state to running', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(1000);
      expect(engine.getState()).toBe('running');
    });

    it('emits initial step event', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const events: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => events.push(e));

      engine.start(1000);
      expect(events).toHaveLength(1);
      expect(events[0]!.stepIndex).toBe(0);
      expect(events[0]!.step.name).toBe('Work');
      expect(events[0]!.startedAt).toBe(1000);
    });

    it('throws when already running', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(1000);
      expect(() => engine.start(2000)).toThrow('Workout is already running');
    });

    it('emits state via state$', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const states: WorkoutState[] = [];
      engine.state$.subscribe((s) => states.push(s));

      engine.start(1000);
      expect(states).toContain('running');
    });
  });

  describe('ingest()', () => {
    it('is no-op when idle', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const events: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => events.push(e));

      engine.ingest(makePacket(1000, 150));
      expect(events).toHaveLength(0);
      expect(engine.getState()).toBe('idle');
    });

    it('is no-op when completed', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 10 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const stepEvents: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => stepEvents.push(e));

      engine.start(0);
      engine.ingest(makePacket(10_000, 150)); // completes the step
      const countAfterComplete = stepEvents.length;

      engine.ingest(makePacket(20_000, 150));
      // No new step events after completion
      expect(stepEvents).toHaveLength(countAfterComplete);
      expect(engine.getState()).toBe('completed');
    });

    it('advances steps based on elapsed time', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Warmup', type: 'warmup' as const, durationSec: 10 },
          { name: 'Work', type: 'work' as const, durationSec: 20 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const events: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => events.push(e));

      engine.start(0);
      expect(events).toHaveLength(1); // initial step

      // Within first step
      engine.ingest(makePacket(5_000, 120));
      expect(engine.currentStepIdx).toBe(0);

      // Advance past first step
      engine.ingest(makePacket(10_000, 150));
      expect(engine.currentStepIdx).toBe(1);
      expect(events).toHaveLength(2);
      expect(events[1]!.step.name).toBe('Work');
    });

    it('completes workout after all steps', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 10 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      engine.ingest(makePacket(10_000, 150));

      expect(engine.getState()).toBe('completed');
      expect(engine.currentStep()).toBeUndefined();
    });

    it('emits step change events on step transitions', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'A', type: 'warmup' as const, durationSec: 5 },
          { name: 'B', type: 'work' as const, durationSec: 5 },
          { name: 'C', type: 'cooldown' as const, durationSec: 5 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const events: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => events.push(e));

      engine.start(0);
      engine.ingest(makePacket(5_000, 150));
      engine.ingest(makePacket(10_000, 130));

      expect(events).toHaveLength(3);
      expect(events.map((e) => e.step.name)).toEqual(['A', 'B', 'C']);
    });

    it('checks target compliance with zone target', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 60, target: { zone: 4 as const } },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const targets: TargetEvent[] = [];
      engine.target$.subscribe((e) => targets.push(e));

      engine.start(0);

      // Zone 4 = 80-90% of 200 = 160-180 BPM
      engine.ingest(makePacket(1000, 170)); // in zone 4
      expect(targets).toHaveLength(1);
      expect(targets[0]!.onTarget).toBe(true);

      engine.ingest(makePacket(2000, 100)); // zone 1, not on target
      expect(targets).toHaveLength(2);
      expect(targets[1]!.onTarget).toBe(false);
    });

    it('checks target compliance with hrRange target', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 60, target: { hrRange: [140, 160] as [number, number] } },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const targets: TargetEvent[] = [];
      engine.target$.subscribe((e) => targets.push(e));

      engine.start(0);

      engine.ingest(makePacket(1000, 150)); // in range
      expect(targets[0]!.onTarget).toBe(true);

      engine.ingest(makePacket(2000, 130)); // below range
      expect(targets[1]!.onTarget).toBe(false);

      engine.ingest(makePacket(3000, 170)); // above range
      expect(targets[2]!.onTarget).toBe(false);
    });

    it('does not emit target event when step has no target', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 60 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const targets: TargetEvent[] = [];
      engine.target$.subscribe((e) => targets.push(e));

      engine.start(0);
      engine.ingest(makePacket(1000, 150));
      expect(targets).toHaveLength(0);
    });
  });

  describe('pause/resume', () => {
    it('pauses and resumes correctly', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'Work', type: 'work' as const, durationSec: 30 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      engine.ingest(makePacket(5_000, 150));

      engine.pause();
      expect(engine.getState()).toBe('paused');

      // Ingest during pause should be ignored
      engine.ingest(makePacket(15_000, 160));
      expect(engine.stepElapsedSec()).toBe(5); // unchanged

      engine.resume(20_000);
      expect(engine.getState()).toBe('running');

      // After resume, step time should account for pause offset
      engine.ingest(makePacket(25_000, 140));
      expect(engine.stepElapsedSec()).toBe(10); // 5s before pause + 5s after resume
    });

    it('emits state changes on pause and resume', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const states: WorkoutState[] = [];
      engine.state$.subscribe((s) => states.push(s));

      engine.start(0);
      engine.pause();
      engine.resume(5_000);

      expect(states).toEqual(['running', 'paused', 'running']);
    });

    it('pause is no-op when not running', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.pause();
      expect(engine.getState()).toBe('idle');
    });

    it('resume is no-op when not paused', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      engine.resume(5_000); // already running
      expect(engine.getState()).toBe('running');
    });
  });

  describe('time accessors', () => {
    it('stepRemainingSec() returns correct value', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 30 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      engine.ingest(makePacket(10_000, 150));

      expect(engine.stepRemainingSec()).toBe(20);
    });

    it('totalElapsedSec() returns elapsed time', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'A', type: 'work' as const, durationSec: 10 },
          { name: 'B', type: 'work' as const, durationSec: 10 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      engine.ingest(makePacket(15_000, 150));

      expect(engine.totalElapsedSec()).toBe(15);
    });

    it('totalDurationSec() matches sum of all step durations', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'A', type: 'warmup' as const, durationSec: 60 },
          { name: 'B', type: 'work' as const, durationSec: 30, repeat: 4 },
          { name: 'C', type: 'cooldown' as const, durationSec: 60 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      // 60 + (30 × 4) + 60 = 240
      expect(engine.totalDurationSec()).toBe(240);
    });

    it('stepElapsedSec() and stepRemainingSec() return 0 when idle', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 30 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      expect(engine.stepElapsedSec()).toBe(0);
      expect(engine.stepRemainingSec()).toBe(0);
    });

    it('totalElapsedSec() returns 0 when idle', () => {
      const protocol = {
        name: 'Test',
        steps: [{ name: 'Work', type: 'work' as const, durationSec: 30 }],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      expect(engine.totalElapsedSec()).toBe(0);
    });
  });

  describe('empty protocol', () => {
    it('completes immediately on start', () => {
      const protocol = { name: 'Empty', steps: [] };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      engine.start(0);
      expect(engine.getState()).toBe('completed');
    });
  });

  describe('multi-step skip', () => {
    it('skips multiple steps in a single ingest if time has advanced far enough', () => {
      const protocol = {
        name: 'Test',
        steps: [
          { name: 'A', type: 'work' as const, durationSec: 5 },
          { name: 'B', type: 'work' as const, durationSec: 5 },
          { name: 'C', type: 'work' as const, durationSec: 5 },
        ],
      };
      const engine = new WorkoutEngine(protocol, zoneConfig);
      const events: StepChangeEvent[] = [];
      engine.step$.subscribe((e) => events.push(e));

      engine.start(0);
      // Jump past A and B in one packet
      engine.ingest(makePacket(12_000, 150));

      expect(engine.currentStepIdx).toBe(2);
      expect(events).toHaveLength(3); // A (start) + B + C
    });
  });
});

describe('Preset protocols', () => {
  describe('tabataProtocol()', () => {
    it('returns a valid Tabata protocol', () => {
      const p = tabataProtocol();
      expect(p.name).toBe('Tabata');
      expect(p.steps.length).toBeGreaterThan(0);

      // Should have warmup + 8×(work+rest) + cooldown = 1 + 16 + 1 = 18
      expect(p.steps).toHaveLength(18);
      expect(p.steps[0]!.type).toBe('warmup');
      expect(p.steps[p.steps.length - 1]!.type).toBe('cooldown');
    });

    it('has correct total duration', () => {
      const p = tabataProtocol();
      const engine = new WorkoutEngine(p, zoneConfig);
      // 60 + 8×(20+10) + 60 = 60 + 240 + 60 = 360
      expect(engine.totalDurationSec()).toBe(360);
    });
  });

  describe('emomProtocol()', () => {
    it('creates correct number of steps', () => {
      const p = emomProtocol(5, 30);
      // 5 minutes × (work + rest) = 10 steps
      expect(p.steps).toHaveLength(10);
    });

    it('has correct total duration', () => {
      const p = emomProtocol(5, 30);
      const engine = new WorkoutEngine(p, zoneConfig);
      // 5 minutes = 300 seconds
      expect(engine.totalDurationSec()).toBe(300);
    });
  });

  describe('pyramidProtocol()', () => {
    it('creates ascending/descending work with rest between', () => {
      const p = pyramidProtocol([30, 60, 90, 60, 30], 15);
      // 5 work + 4 rest = 9 steps
      expect(p.steps).toHaveLength(9);
      expect(p.steps[0]!.durationSec).toBe(30);
      expect(p.steps[2]!.durationSec).toBe(60);
      expect(p.steps[4]!.durationSec).toBe(90);
    });

    it('has correct total duration', () => {
      const p = pyramidProtocol([30, 60, 90, 60, 30], 15);
      const engine = new WorkoutEngine(p, zoneConfig);
      // work: 30+60+90+60+30 = 270, rest: 4×15 = 60, total = 330
      expect(engine.totalDurationSec()).toBe(330);
    });
  });

  describe('bjjRoundsProtocol()', () => {
    it('creates correct structure', () => {
      const p = bjjRoundsProtocol(3, 300, 60);
      expect(p.steps[0]!.type).toBe('warmup');
      expect(p.steps[p.steps.length - 1]!.type).toBe('cooldown');

      const workSteps = p.steps.filter((s) => s.type === 'work');
      expect(workSteps).toHaveLength(3);
    });

    it('has correct total duration', () => {
      const p = bjjRoundsProtocol(3, 300, 60);
      const engine = new WorkoutEngine(p, zoneConfig);
      // 120 + 3×300 + 2×60 + 60 = 120 + 900 + 120 + 60 = 1200
      expect(engine.totalDurationSec()).toBe(1200);
    });
  });

  describe('intervalProtocol()', () => {
    it('creates simple work/rest rounds', () => {
      const p = intervalProtocol(4, 60, 30);
      // 4 × (work + rest) = 8 steps
      expect(p.steps).toHaveLength(8);
    });

    it('has correct total duration', () => {
      const p = intervalProtocol(4, 60, 30);
      const engine = new WorkoutEngine(p, zoneConfig);
      // 4 × (60 + 30) = 360
      expect(engine.totalDurationSec()).toBe(360);
    });

    it('has no warmup or cooldown', () => {
      const p = intervalProtocol(2, 30, 15);
      const warmups = p.steps.filter((s) => s.type === 'warmup');
      const cooldowns = p.steps.filter((s) => s.type === 'cooldown');
      expect(warmups).toHaveLength(0);
      expect(cooldowns).toHaveLength(0);
    });
  });
});

describe('WorkoutEngine edge cases', () => {
  it('handles zero-duration steps', () => {
    const protocol = {
      name: 'Zero',
      steps: [
        { name: 'Skip', type: 'work' as const, durationSec: 0 },
        { name: 'Actual', type: 'work' as const, durationSec: 10 },
      ],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    engine.start(0);
    // Zero-duration step is skipped on the first ingest (elapsed 0 >= 0)
    engine.ingest(makePacket(0, 150));
    expect(engine.currentStep()?.name).toBe('Actual');
  });

  it('double pause is no-op', () => {
    const protocol = {
      name: 'Test',
      steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    const states: WorkoutState[] = [];
    engine.state$.subscribe((s) => states.push(s));

    engine.start(0);
    engine.pause();
    engine.pause(); // second pause — no-op
    expect(engine.getState()).toBe('paused');
    // Only one 'paused' state emitted
    expect(states.filter((s) => s === 'paused')).toHaveLength(1);
  });

  it('resume while running is no-op', () => {
    const protocol = {
      name: 'Test',
      steps: [{ name: 'Work', type: 'work' as const, durationSec: 60 }],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    engine.start(0);
    engine.resume(5000); // already running — no crash, no state change
    expect(engine.getState()).toBe('running');
  });

  it('ingest after completion is no-op', () => {
    const protocol = {
      name: 'Test',
      steps: [{ name: 'Work', type: 'work' as const, durationSec: 5 }],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    engine.start(0);
    engine.ingest(makePacket(5000, 150)); // completes
    expect(engine.getState()).toBe('completed');

    engine.ingest(makePacket(10000, 160)); // after completion — no-op
    expect(engine.getState()).toBe('completed');
  });

  it('handles hrRange target correctly at boundaries', () => {
    const protocol = {
      name: 'Test',
      steps: [
        { name: 'Work', type: 'work' as const, durationSec: 60, target: { hrRange: [120, 160] as [number, number] } },
      ],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    const targets: TargetEvent[] = [];
    engine.target$.subscribe((e) => targets.push(e));

    engine.start(0);

    engine.ingest(makePacket(1000, 119)); // below range
    expect(targets[0]!.onTarget).toBe(false);

    engine.ingest(makePacket(2000, 120)); // at lower bound — on target
    expect(targets[1]!.onTarget).toBe(true);

    engine.ingest(makePacket(3000, 160)); // at upper bound — on target
    expect(targets[2]!.onTarget).toBe(true);

    engine.ingest(makePacket(4000, 161)); // above range
    expect(targets[3]!.onTarget).toBe(false);
  });

  it('start from completed state resets correctly', () => {
    const protocol = {
      name: 'Test',
      steps: [{ name: 'Work', type: 'work' as const, durationSec: 5 }],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    engine.start(0);
    engine.ingest(makePacket(5000, 150)); // completes
    expect(engine.getState()).toBe('completed');

    // Start again from completed state
    engine.start(10000);
    expect(engine.getState()).toBe('running');
    expect(engine.currentStepIdx).toBe(0);
    expect(engine.currentStep()?.name).toBe('Work');
  });

  it('getExpandedSteps returns a copy', () => {
    const protocol = {
      name: 'Test',
      steps: [
        { name: 'A', type: 'work' as const, durationSec: 10 },
        { name: 'B', type: 'work' as const, durationSec: 10 },
      ],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    const steps = engine.getExpandedSteps();
    steps.push({ name: 'Injected', type: 'rest', durationSec: 99 });

    // Engine's internal steps should not be affected
    expect(engine.getExpandedSteps()).toHaveLength(2);
  });

  it('pause preserves step elapsed time', () => {
    const protocol = {
      name: 'Test',
      steps: [{ name: 'Work', type: 'work' as const, durationSec: 30 }],
    };
    const engine = new WorkoutEngine(protocol, zoneConfig);
    engine.start(0);
    engine.ingest(makePacket(5000, 150)); // 5s elapsed
    expect(engine.stepElapsedSec()).toBe(5);

    engine.pause();
    engine.resume(10000); // 5s paused

    engine.ingest(makePacket(15000, 140)); // 5s after resume
    // Should be 5s (before pause) + 5s (after resume) = 10s, not 15s
    expect(engine.stepElapsedSec()).toBe(10);
  });
});
