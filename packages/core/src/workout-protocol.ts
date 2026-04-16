import type { HRPacket, HRZoneConfig, ReadableStream } from './types.js';
import { hrToZone } from './zones.js';
import { HRKitError } from './errors.js';
import { SimpleStream } from './stream.js';

/** Target for a workout step. */
export interface StepTarget {
  /** Target HR zone (1-5). */
  zone?: 1 | 2 | 3 | 4 | 5;
  /** Target HR range [min, max] in BPM. */
  hrRange?: [number, number];
}

/** A single step in a workout protocol. */
export interface WorkoutStep {
  /** Step name (e.g., "Warmup", "Work", "Rest", "Cooldown"). */
  name: string;
  /** Step type. */
  type: 'warmup' | 'work' | 'rest' | 'cooldown';
  /** Duration in seconds. */
  durationSec: number;
  /** Optional target for this step. */
  target?: StepTarget;
  /** Number of times to repeat this step (default 1, used for intervals). */
  repeat?: number;
}

/** A complete workout protocol definition. */
export interface WorkoutProtocol {
  /** Protocol name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Ordered list of steps. Steps with repeat > 1 are expanded internally. */
  steps: WorkoutStep[];
}

/** Current state of workout execution. */
export type WorkoutState = 'idle' | 'running' | 'paused' | 'completed';

/** Event emitted when a step changes. */
export interface StepChangeEvent {
  /** Index of the new step in the expanded step list. */
  stepIndex: number;
  /** The step definition. */
  step: WorkoutStep;
  /** Timestamp when the step started. */
  startedAt: number;
}

/** Event emitted when target compliance changes. */
export interface TargetEvent {
  /** Whether the athlete is currently in the target zone/range. */
  onTarget: boolean;
  /** Current HR. */
  hr: number;
  /** Current step's target. */
  target: StepTarget;
}

// ── Types ───────────────────────────────────────────────────────────────

/** Expand steps with `repeat > 1` into individual entries. */
function expandSteps(steps: WorkoutStep[]): WorkoutStep[] {
  const expanded: WorkoutStep[] = [];
  for (const step of steps) {
    if (step.durationSec < 0) {
      throw new HRKitError(`Step "${step.name}" has negative duration: ${step.durationSec}`);
    }
    const count = step.repeat && step.repeat > 1 ? step.repeat : 1;
    for (let i = 0; i < count; i++) {
      expanded.push({ ...step, repeat: undefined });
    }
  }
  return expanded;
}

// ── WorkoutEngine ───────────────────────────────────────────────────────

/**
 * Executes a workout protocol, tracking step progression and target compliance.
 * Consumes HR packets and emits step/target events via observable streams.
 *
 * The engine expands steps with `repeat > 1` into individual step entries.
 * Steps advance based on elapsed time from HR packet timestamps.
 */
export class WorkoutEngine {
  private expandedSteps: WorkoutStep[];
  private zoneConfig: HRZoneConfig;
  private _state: WorkoutState = 'idle';
  private _currentStepIndex = 0;
  private stepStartTime = 0;
  private startTime = 0;
  private pauseAccumulated = 0;
  private pauseStartTime = 0;
  private lastPacketTimestamp = 0;

  private stepStream = new SimpleStream<StepChangeEvent>();
  private targetStream = new SimpleStream<TargetEvent>();
  private stateStream = new SimpleStream<WorkoutState>();

  /** Observable: emits when the current step changes. */
  readonly step$: ReadableStream<StepChangeEvent> = this.stepStream;
  /** Observable: emits target compliance on each HR packet. */
  readonly target$: ReadableStream<TargetEvent> = this.targetStream;
  /** Observable: emits the current workout state. */
  readonly state$: ReadableStream<WorkoutState> = this.stateStream;

  constructor(protocol: WorkoutProtocol, zoneConfig: HRZoneConfig) {
    this.zoneConfig = zoneConfig;
    this.expandedSteps = expandSteps(protocol.steps);
  }

  /**
   * Start the workout. Marks state as 'running' and sets step 0.
   *
   * @param timestamp - Start timestamp in ms (e.g., from the first HR packet).
   * @throws {HRKitError} if the workout is already running.
   */
  start(timestamp: number): void {
    if (this._state === 'running') {
      throw new HRKitError('Workout is already running');
    }
    this._state = 'running';
    this.stateStream.emit('running');
    this.startTime = timestamp;
    this._currentStepIndex = 0;
    this.stepStartTime = timestamp;
    this.pauseAccumulated = 0;
    this.lastPacketTimestamp = timestamp;

    if (this.expandedSteps.length > 0) {
      this.stepStream.emit({
        stepIndex: 0,
        step: this.expandedSteps[0]!,
        startedAt: timestamp,
      });
    } else {
      this._state = 'completed';
      this.stateStream.emit('completed');
    }
  }

  /**
   * Feed an HR packet. Advances steps based on elapsed time and checks target compliance.
   * Automatically transitions to 'completed' state when all steps are done.
   *
   * @param packet - Parsed HR packet with timestamp.
   */
  ingest(packet: HRPacket): void {
    if (this._state !== 'running') return;

    this.lastPacketTimestamp = packet.timestamp;

    // Advance steps based on elapsed time
    while (this._currentStepIndex < this.expandedSteps.length) {
      const step = this.expandedSteps[this._currentStepIndex]!;
      const elapsed = (packet.timestamp - this.stepStartTime) / 1000;

      if (elapsed >= step.durationSec) {
        this._currentStepIndex++;
        if (this._currentStepIndex >= this.expandedSteps.length) {
          this._state = 'completed';
          this.stateStream.emit('completed');
          return;
        }
        this.stepStartTime = this.stepStartTime + step.durationSec * 1000;
        const nextStep = this.expandedSteps[this._currentStepIndex]!;
        this.stepStream.emit({
          stepIndex: this._currentStepIndex,
          step: nextStep,
          startedAt: this.stepStartTime,
        });
      } else {
        break;
      }
    }

    // Check target compliance for current step
    if (this._currentStepIndex < this.expandedSteps.length) {
      const step = this.expandedSteps[this._currentStepIndex]!;
      if (step.target) {
        const onTarget = this.checkTarget(packet.hr, step.target);
        this.targetStream.emit({
          onTarget,
          hr: packet.hr,
          target: step.target,
        });
      }
    }
  }

  /** Pause the workout. */
  pause(): void {
    if (this._state !== 'running') return;
    this._state = 'paused';
    this.pauseStartTime = this.lastPacketTimestamp;
    this.stateStream.emit('paused');
  }

  /**
   * Resume the workout. Adjusts step and start times by the paused duration
   * so elapsed time calculations remain accurate.
   *
   * @param timestamp - Resume timestamp in ms.
   */
  resume(timestamp: number): void {
    if (this._state !== 'paused') return;
    const pausedDuration = timestamp - this.pauseStartTime;
    this.pauseAccumulated += pausedDuration;
    this.stepStartTime += pausedDuration;
    this.startTime += pausedDuration;
    this._state = 'running';
    this.lastPacketTimestamp = timestamp;
    this.stateStream.emit('running');
  }

  /**
   * Get the current expanded step, or undefined if idle/completed.
   *
   * @returns Current {@link WorkoutStep}, or `undefined` when idle or completed.
   */
  currentStep(): WorkoutStep | undefined {
    if (this._state === 'idle' || this._state === 'completed') return undefined;
    return this.expandedSteps[this._currentStepIndex];
  }

  /** Get the current step index. */
  get currentStepIdx(): number {
    return this._currentStepIndex;
  }

  /**
   * Get elapsed time in current step (seconds).
   *
   * @returns Elapsed seconds in the current step, or 0 when idle/completed.
   */
  stepElapsedSec(): number {
    if (this._state === 'idle' || this._state === 'completed') return 0;
    return (this.lastPacketTimestamp - this.stepStartTime) / 1000;
  }

  /**
   * Get remaining time in current step (seconds).
   *
   * @returns Remaining seconds in the current step, or 0 when idle/completed.
   */
  stepRemainingSec(): number {
    if (this._state === 'idle' || this._state === 'completed') return 0;
    const step = this.expandedSteps[this._currentStepIndex];
    if (!step) return 0;
    return Math.max(0, step.durationSec - this.stepElapsedSec());
  }

  /**
   * Total elapsed workout time (seconds).
   *
   * @returns Seconds elapsed since `start()`, or 0 when idle.
   */
  totalElapsedSec(): number {
    if (this._state === 'idle') return 0;
    return (this.lastPacketTimestamp - this.startTime) / 1000;
  }

  /**
   * Total workout duration (seconds, sum of all expanded steps).
   *
   * @returns Planned total workout duration in seconds.
   */
  totalDurationSec(): number {
    return this.expandedSteps.reduce((sum, s) => sum + s.durationSec, 0);
  }

  /** Get the expanded steps list. */
  getExpandedSteps(): WorkoutStep[] {
    return [...this.expandedSteps];
  }

  /** Current workout state. */
  getState(): WorkoutState {
    return this._state;
  }

  private checkTarget(hr: number, target: StepTarget): boolean {
    if (target.zone !== undefined) {
      return hrToZone(hr, this.zoneConfig) === target.zone;
    }
    if (target.hrRange !== undefined) {
      return hr >= target.hrRange[0] && hr <= target.hrRange[1];
    }
    return true;
  }
}

// ── Preset Protocols ────────────────────────────────────────────────────

/**
 * Create a Tabata protocol (20s work / 10s rest × 8 rounds).
 *
 * @returns A {@link WorkoutProtocol} with warmup, 8 work/rest cycles, and cooldown.
 */
export function tabataProtocol(): WorkoutProtocol {
  const steps: WorkoutStep[] = [
    { name: 'Warmup', type: 'warmup', durationSec: 60 },
  ];

  for (let i = 0; i < 8; i++) {
    steps.push({
      name: `Work ${i + 1}`,
      type: 'work',
      durationSec: 20,
      target: { zone: 5 },
    });
    steps.push({
      name: `Rest ${i + 1}`,
      type: 'rest',
      durationSec: 10,
      target: { zone: 1 },
    });
  }

  steps.push({ name: 'Cooldown', type: 'cooldown', durationSec: 60 });

  return {
    name: 'Tabata',
    description: '20s work / 10s rest × 8 rounds',
    steps,
  };
}

/**
 * Create an EMOM protocol (work at top of each minute for N minutes).
 *
 * @param minutes - Total number of minutes.
 * @param workSec - Seconds of work at the top of each minute.
 * @returns A {@link WorkoutProtocol} with alternating work/rest steps.
 */
export function emomProtocol(minutes: number, workSec: number): WorkoutProtocol {
  const steps: WorkoutStep[] = [];
  const restSec = 60 - workSec;

  for (let i = 0; i < minutes; i++) {
    steps.push({
      name: `Work ${i + 1}`,
      type: 'work',
      durationSec: workSec,
      target: { zone: 4 },
    });
    if (restSec > 0) {
      steps.push({
        name: `Rest ${i + 1}`,
        type: 'rest',
        durationSec: restSec,
        target: { zone: 2 },
      });
    }
  }

  return {
    name: 'EMOM',
    description: `${workSec}s work every minute for ${minutes} minutes`,
    steps,
  };
}

/**
 * Create a pyramid interval protocol (ascending then descending work durations).
 *
 * @param steps - Array of work durations in seconds (e.g., `[30, 60, 90, 60, 30]`).
 * @param restSec - Rest duration between work steps in seconds.
 * @returns A {@link WorkoutProtocol} with work/rest steps following the given pyramid.
 */
export function pyramidProtocol(steps: number[], restSec: number): WorkoutProtocol {
  const workoutSteps: WorkoutStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    workoutSteps.push({
      name: `Work ${i + 1}`,
      type: 'work',
      durationSec: steps[i]!,
    });
    if (i < steps.length - 1) {
      workoutSteps.push({
        name: `Rest ${i + 1}`,
        type: 'rest',
        durationSec: restSec,
      });
    }
  }

  return {
    name: 'Pyramid',
    description: `Pyramid intervals: ${steps.join('s → ')}s`,
    steps: workoutSteps,
  };
}

/**
 * Create a BJJ rounds protocol (N rounds of workSec with restSec between).
 *
 * @param rounds - Number of sparring rounds.
 * @param workSec - Duration of each round in seconds.
 * @param restSec - Rest duration between rounds in seconds.
 * @returns A {@link WorkoutProtocol} with warmup, rounds, and cooldown.
 */
export function bjjRoundsProtocol(rounds: number, workSec: number, restSec: number): WorkoutProtocol {
  const steps: WorkoutStep[] = [
    { name: 'Warmup', type: 'warmup', durationSec: 120 },
  ];

  for (let i = 0; i < rounds; i++) {
    steps.push({
      name: `Round ${i + 1}`,
      type: 'work',
      durationSec: workSec,
      target: { zone: 4 },
    });
    if (i < rounds - 1) {
      steps.push({
        name: `Rest ${i + 1}`,
        type: 'rest',
        durationSec: restSec,
        target: { zone: 1 },
      });
    }
  }

  steps.push({ name: 'Cooldown', type: 'cooldown', durationSec: 60 });

  return {
    name: 'BJJ Rounds',
    description: `${rounds} × ${workSec}s rounds with ${restSec}s rest`,
    steps,
  };
}

/**
 * Create a simple interval protocol (repeated work/rest cycles).
 *
 * @param rounds - Number of work/rest cycles.
 * @param workSec - Duration of each work interval in seconds.
 * @param restSec - Duration of each rest interval in seconds.
 * @returns A {@link WorkoutProtocol} with alternating work/rest steps.
 */
export function intervalProtocol(rounds: number, workSec: number, restSec: number): WorkoutProtocol {
  const steps: WorkoutStep[] = [];

  for (let i = 0; i < rounds; i++) {
    steps.push({
      name: `Work ${i + 1}`,
      type: 'work',
      durationSec: workSec,
    });
    steps.push({
      name: `Rest ${i + 1}`,
      type: 'rest',
      durationSec: restSec,
    });
  }

  return {
    name: 'Intervals',
    description: `${rounds} × ${workSec}s work / ${restSec}s rest`,
    steps,
  };
}
