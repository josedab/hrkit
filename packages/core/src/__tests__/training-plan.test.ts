import { describe, expect, it } from 'vitest';
import { createWeeklyPlan, PlanRunner, type TrainingPlan } from '../training-plan.js';

function makeTestPlan(): TrainingPlan {
  return {
    id: 'test-plan',
    name: '5K Base Building',
    version: 1,
    blocks: [
      {
        name: 'Base',
        focus: 'Aerobic foundation',
        weeks: [
          {
            weekNumber: 1,
            days: [
              { dayOfWeek: 0, dsl: '', isRest: true },
              { dayOfWeek: 1, dsl: 'name: Easy Run\nwarmup 5m @zone 1\nwork 20m @zone 2\ncooldown 5m @zone 1' },
              { dayOfWeek: 2, dsl: '', isRest: true },
              { dayOfWeek: 3, dsl: 'name: Tempo\nwarmup 10m @zone 1\nwork 15m @zone 3\ncooldown 5m @zone 1' },
              { dayOfWeek: 4, dsl: '', isRest: true },
              { dayOfWeek: 5, dsl: 'name: Long Run\nwarmup 10m @zone 1\nwork 30m @zone 2\ncooldown 10m @zone 1' },
              { dayOfWeek: 6, dsl: '', isRest: true },
            ],
          },
          {
            weekNumber: 2,
            days: [
              { dayOfWeek: 1, dsl: 'name: Easy Run\nwork 25m @zone 2' },
              { dayOfWeek: 3, dsl: 'name: Intervals\nrepeat 4\nwork 3m @zone 4\nrest 2m @zone 1\nend' },
            ],
          },
        ],
      },
      {
        name: 'Build',
        weeks: [
          {
            weekNumber: 1,
            days: [{ dayOfWeek: 1, dsl: 'name: Build Easy\nwork 30m @zone 2' }],
          },
        ],
      },
    ],
    tags: ['running', '5k', 'beginner'],
  };
}

describe('PlanRunner', () => {
  it('initializes with correct progress', () => {
    const runner = new PlanRunner(makeTestPlan());
    const progress = runner.currentProgress;
    expect(progress.blockIndex).toBe(0);
    expect(progress.weekIndex).toBe(0);
    expect(progress.totalCompleted).toBe(0);
    expect(progress.totalPrescribed).toBe(6); // 3 + 2 + 1 work days
    expect(progress.complianceRate).toBe(1);
  });

  it('getSession returns workout for scheduled day', () => {
    const runner = new PlanRunner(makeTestPlan());
    const monday = runner.getSession(1);
    expect(monday).not.toBeNull();
    expect(monday!.dsl).toContain('Easy Run');
    expect(monday!.protocol).toBeDefined();
    expect(monday!.protocol!.name).toBe('Easy Run');
  });

  it('getSession returns null for rest days', () => {
    const runner = new PlanRunner(makeTestPlan());
    expect(runner.getSession(0)).toBeNull(); // Sunday = rest
  });

  it('getSession returns null for unscheduled days', () => {
    const runner = new PlanRunner(makeTestPlan());
    expect(runner.getSession(2)).toBeNull(); // Tuesday not scheduled in week 1
  });

  it('markCompleted tracks completion', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.markCompleted(1); // Monday
    expect(runner.currentProgress.totalCompleted).toBe(1);
    expect(runner.currentProgress.completedDays).toContain(1);
  });

  it('markCompleted is idempotent', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.markCompleted(1);
    runner.markCompleted(1);
    expect(runner.currentProgress.totalCompleted).toBe(1);
  });

  it('markSkipped tracks skips and reduces compliance', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.markCompleted(1);
    runner.markSkipped(3);
    expect(runner.currentProgress.complianceRate).toBe(0.5);
  });

  it('advanceWeek moves to next week', () => {
    const runner = new PlanRunner(makeTestPlan());
    const hasNext = runner.advanceWeek();
    expect(hasNext).toBe(true);
    expect(runner.currentProgress.weekIndex).toBe(1);
    expect(runner.currentProgress.completedDays).toEqual([]);
  });

  it('advanceWeek crosses block boundary', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.advanceWeek(); // week 2 of Base
    runner.advanceWeek(); // week 1 of Build
    expect(runner.currentProgress.blockIndex).toBe(1);
    expect(runner.currentProgress.weekIndex).toBe(0);
    expect(runner.getCurrentBlock()!.name).toBe('Build');
  });

  it('advanceWeek returns false when plan complete', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.advanceWeek(); // Base week 2
    runner.advanceWeek(); // Build week 1
    const result = runner.advanceWeek(); // no more weeks
    expect(result).toBe(false);
  });

  it('getCurrentWeek returns current week', () => {
    const runner = new PlanRunner(makeTestPlan());
    const week = runner.getCurrentWeek();
    expect(week).not.toBeNull();
    expect(week!.weekNumber).toBe(1);
  });

  it('getCurrentBlock returns current block', () => {
    const runner = new PlanRunner(makeTestPlan());
    expect(runner.getCurrentBlock()!.name).toBe('Base');
  });

  it('getWeekSummary counts correctly', () => {
    const runner = new PlanRunner(makeTestPlan());
    const summary = runner.getWeekSummary();
    expect(summary.total).toBe(3); // Mon, Wed, Fri
    expect(summary.restDays).toBe(4); // Sun, Tue, Thu, Sat
    expect(summary.completed).toBe(0);
    expect(summary.remaining).toBe(3);
  });

  it('getWeekSummary updates after completion', () => {
    const runner = new PlanRunner(makeTestPlan());
    runner.markCompleted(1);
    const summary = runner.getWeekSummary();
    expect(summary.completed).toBe(1);
    expect(summary.remaining).toBe(2);
  });

  it('handles plan with no blocks gracefully', () => {
    const runner = new PlanRunner({
      id: 'empty',
      name: 'Empty',
      version: 1,
      blocks: [],
    });
    expect(runner.getSession(1)).toBeNull();
    expect(runner.getCurrentWeek()).toBeNull();
    expect(runner.advanceWeek()).toBe(false);
  });

  it('parses DSL on first access and caches', () => {
    const runner = new PlanRunner(makeTestPlan());
    const session1 = runner.getSession(1);
    const session2 = runner.getSession(1);
    expect(session1!.protocol).toBeDefined();
    expect(session1!.protocol).toBe(session2!.protocol); // same object (cached)
  });

  it('handles invalid DSL gracefully', () => {
    const plan: TrainingPlan = {
      id: 'bad',
      name: 'Bad DSL',
      version: 1,
      blocks: [
        {
          name: 'Test',
          weeks: [
            {
              weekNumber: 1,
              days: [{ dayOfWeek: 1, dsl: 'this is not valid DSL @@@ !!!' }],
            },
          ],
        },
      ],
    };
    const runner = new PlanRunner(plan);
    const session = runner.getSession(1);
    expect(session).not.toBeNull();
    // Protocol may or may not parse depending on parser tolerance
  });
});

describe('createWeeklyPlan', () => {
  it('creates a repeating plan', () => {
    const plan = createWeeklyPlan(
      'Test Plan',
      {
        1: 'name: Monday\nwork 30m @zone 2',
        3: 'name: Wednesday\nwork 20m @zone 3',
        5: 'name: Friday\nwork 40m @zone 2',
      },
      4,
    );

    expect(plan.name).toBe('Test Plan');
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]!.weeks).toHaveLength(4);

    // Each week should have 7 days
    for (const week of plan.blocks[0]!.weeks) {
      expect(week.days).toHaveLength(7);
      const workDays = week.days.filter((d) => !d.isRest);
      const restDays = week.days.filter((d) => d.isRest);
      expect(workDays).toHaveLength(3);
      expect(restDays).toHaveLength(4);
    }
  });

  it('creates a plan with correct day assignments', () => {
    const plan = createWeeklyPlan('Simple', { 1: 'work 10m @zone 1' }, 1);
    const monday = plan.blocks[0]!.weeks[0]!.days.find((d) => d.dayOfWeek === 1);
    expect(monday!.dsl).toContain('work 10m');
    expect(monday!.isRest).toBeUndefined();

    const sunday = plan.blocks[0]!.weeks[0]!.days.find((d) => d.dayOfWeek === 0);
    expect(sunday!.isRest).toBe(true);
  });
});
