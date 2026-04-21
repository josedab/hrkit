/**
 * Multi-week training plan schema and execution engine.
 *
 * Defines a structured format for periodized training programs built on
 * the Workout DSL. Plans consist of blocks (mesocycles), which contain
 * weeks, which contain daily session prescriptions.
 *
 * The {@link PlanRunner} tracks compliance and adjusts upcoming sessions
 * based on athlete adherence.
 */

import { parseWorkoutDSL } from './workout-dsl.js';
import type { WorkoutProtocol } from './workout-protocol.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface TrainingPlan {
  /** Plan identifier. */
  id: string;
  /** Human-readable plan name. */
  name: string;
  /** Plan description. */
  description?: string;
  /** Plan author. */
  author?: string;
  /** Schema version for forward compatibility. */
  version: 1;
  /** Training blocks (mesocycles). */
  blocks: TrainingBlock[];
  /** Optional tags for categorization. */
  tags?: string[];
}

export interface TrainingBlock {
  /** Block name (e.g., "Base Building", "Build", "Peak", "Taper"). */
  name: string;
  /** Block focus description. */
  focus?: string;
  /** Weeks within this block. */
  weeks: TrainingWeek[];
}

export interface TrainingWeek {
  /** Week number within the block (1-indexed). */
  weekNumber: number;
  /** Optional label (e.g., "Recovery Week"). */
  label?: string;
  /** Daily sessions. Key = day of week (0=Sun, 1=Mon, ... 6=Sat). */
  days: TrainingDay[];
}

export interface TrainingDay {
  /** Day of week (0=Sunday … 6=Saturday). */
  dayOfWeek: number;
  /** Session prescription in Workout DSL format. */
  dsl: string;
  /** Optional pre-parsed protocol (populated by PlanRunner). */
  protocol?: WorkoutProtocol;
  /** Whether this day is a mandatory rest day. */
  isRest?: boolean;
  /** Optional notes for the athlete. */
  notes?: string;
}

export interface PlanProgress {
  /** Current block index (0-based). */
  blockIndex: number;
  /** Current week index within the block (0-based). */
  weekIndex: number;
  /** Days completed in the current week. */
  completedDays: number[];
  /** Days skipped in the current week. */
  skippedDays: number[];
  /** Overall compliance rate (0–1). */
  complianceRate: number;
  /** Total sessions completed across all blocks. */
  totalCompleted: number;
  /** Total sessions prescribed across all blocks. */
  totalPrescribed: number;
}

// ── Plan Runner ─────────────────────────────────────────────────────────

/**
 * Tracks execution of a {@link TrainingPlan}, parsing DSL sessions
 * and managing compliance state.
 *
 * @example
 * ```ts
 * const runner = new PlanRunner(plan);
 * const today = runner.getSession(1); // Monday
 * if (today) {
 *   console.log(today.dsl);
 *   runner.markCompleted(1);
 * }
 * ```
 */
export class PlanRunner {
  private progress: PlanProgress;

  constructor(private readonly plan: TrainingPlan) {
    this.progress = {
      blockIndex: 0,
      weekIndex: 0,
      completedDays: [],
      skippedDays: [],
      complianceRate: 1,
      totalCompleted: 0,
      totalPrescribed: this.countTotalSessions(),
    };
  }

  /** Current plan progress. */
  get currentProgress(): Readonly<PlanProgress> {
    return { ...this.progress };
  }

  /** The underlying plan. */
  get currentPlan(): Readonly<TrainingPlan> {
    return this.plan;
  }

  /**
   * Get today's session for a given day of week.
   *
   * @param dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday.
   * @returns The training day, or null if rest day or no session prescribed.
   */
  getSession(dayOfWeek: number): TrainingDay | null {
    const week = this.getCurrentWeek();
    if (!week) return null;

    const day = week.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day || day.isRest) return null;

    // Parse DSL on first access
    if (!day.protocol && day.dsl) {
      try {
        day.protocol = parseWorkoutDSL(day.dsl);
      } catch {
        // DSL parse error — return the day but without protocol
      }
    }

    return day;
  }

  /** Get the current week's prescription. Returns null if plan is exhausted. */
  getCurrentWeek(): TrainingWeek | null {
    const block = this.plan.blocks[this.progress.blockIndex];
    if (!block) return null;
    return block.weeks[this.progress.weekIndex] ?? null;
  }

  /** Get the current block. Returns null if plan is exhausted. */
  getCurrentBlock(): TrainingBlock | null {
    return this.plan.blocks[this.progress.blockIndex] ?? null;
  }

  /** Mark a day as completed. */
  markCompleted(dayOfWeek: number): void {
    if (!this.progress.completedDays.includes(dayOfWeek)) {
      this.progress.completedDays.push(dayOfWeek);
      this.progress.totalCompleted++;
      this.updateCompliance();
    }
  }

  /** Mark a day as skipped. */
  markSkipped(dayOfWeek: number): void {
    if (!this.progress.skippedDays.includes(dayOfWeek)) {
      this.progress.skippedDays.push(dayOfWeek);
      this.updateCompliance();
    }
  }

  /**
   * Advance to the next week. Returns true if there's a next week,
   * false if the plan is completed.
   */
  advanceWeek(): boolean {
    const block = this.plan.blocks[this.progress.blockIndex];
    if (!block) return false;

    this.progress.weekIndex++;
    this.progress.completedDays = [];
    this.progress.skippedDays = [];

    if (this.progress.weekIndex >= block.weeks.length) {
      // Move to next block
      this.progress.blockIndex++;
      this.progress.weekIndex = 0;
      if (this.progress.blockIndex >= this.plan.blocks.length) {
        return false; // plan complete
      }
    }
    return true;
  }

  /** Get a summary of the week's remaining sessions. */
  getWeekSummary(): { total: number; completed: number; remaining: number; restDays: number } {
    const week = this.getCurrentWeek();
    if (!week) return { total: 0, completed: 0, remaining: 0, restDays: 0 };

    const workDays = week.days.filter((d) => !d.isRest);
    const restDays = week.days.filter((d) => d.isRest).length;
    const completed = this.progress.completedDays.length;

    return {
      total: workDays.length,
      completed,
      remaining: Math.max(0, workDays.length - completed - this.progress.skippedDays.length),
      restDays,
    };
  }

  private countTotalSessions(): number {
    let count = 0;
    for (const block of this.plan.blocks) {
      for (const week of block.weeks) {
        count += week.days.filter((d) => !d.isRest).length;
      }
    }
    return count;
  }

  private updateCompliance(): void {
    const total = this.progress.totalCompleted + this.progress.skippedDays.length;
    this.progress.complianceRate = total > 0 ? this.progress.totalCompleted / total : 1;
  }
}

// ── Plan Builders ───────────────────────────────────────────────────────

/**
 * Create a simple repeating weekly plan.
 *
 * @param name - Plan name.
 * @param weeklySchedule - Map of dayOfWeek → DSL string.
 * @param weeks - Number of weeks to repeat.
 * @returns A training plan.
 *
 * @example
 * ```ts
 * const plan = createWeeklyPlan('Base Phase', {
 *   1: 'name: Easy\nwork 30m @zone 2',  // Monday
 *   3: 'name: Tempo\nwork 20m @zone 3', // Wednesday
 *   5: 'name: Long\nwork 60m @zone 2',  // Friday
 * }, 4);
 * const runner = new PlanRunner(plan);
 * ```
 */
export function createWeeklyPlan(name: string, weeklySchedule: Record<number, string>, weeks: number): TrainingPlan {
  const trainingWeeks: TrainingWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const days: TrainingDay[] = [];
    for (let d = 0; d <= 6; d++) {
      const dsl = weeklySchedule[d];
      if (dsl) {
        days.push({ dayOfWeek: d, dsl });
      } else {
        days.push({ dayOfWeek: d, dsl: '', isRest: true });
      }
    }
    trainingWeeks.push({ weekNumber: w + 1, days });
  }

  return {
    id: `plan-${Date.now()}`,
    name,
    version: 1,
    blocks: [{ name: 'Main', weeks: trainingWeeks }],
  };
}
