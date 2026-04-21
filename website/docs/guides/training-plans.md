---
sidebar_position: 18
title: Training Plans
description: Multi-week periodized training plans with compliance tracking.
---

# Training Plans

@hrkit supports structured, multi-week training plans built on the [Workout DSL](/docs/guides/workout-protocols). Plans consist of **blocks** (mesocycles) → **weeks** → **days**, with the `PlanRunner` tracking athlete compliance.

## Quick Start

```typescript
import { createWeeklyPlan, PlanRunner } from '@hrkit/core';

const plan = createWeeklyPlan('5K Base Building', {
  1: 'name: Easy Run\nwarmup 5m @zone 1\nwork 25m @zone 2\ncooldown 5m @zone 1',   // Monday
  3: 'name: Tempo\nwarmup 10m @zone 1\nwork 20m @zone 3\ncooldown 5m @zone 1',      // Wednesday
  5: 'name: Long Run\nwarmup 10m @zone 1\nwork 40m @zone 2\ncooldown 10m @zone 1',  // Friday
}, 4); // 4-week block

const runner = new PlanRunner(plan);

// Get today's session (0=Sun, 1=Mon, ..., 6=Sat)
const today = runner.getSession(1); // Monday
if (today) {
  console.log(today.protocol?.name);  // "Easy Run"
  console.log(today.dsl);             // full DSL text
}
```

## Plan Structure

```typescript
interface TrainingPlan {
  id: string;
  name: string;
  version: 1;
  blocks: TrainingBlock[];  // Mesocycles
  tags?: string[];
}

interface TrainingBlock {
  name: string;             // e.g., "Base", "Build", "Peak", "Taper"
  focus?: string;
  weeks: TrainingWeek[];
}

interface TrainingWeek {
  weekNumber: number;
  label?: string;           // e.g., "Recovery Week"
  days: TrainingDay[];
}

interface TrainingDay {
  dayOfWeek: number;        // 0=Sunday ... 6=Saturday
  dsl: string;              // Workout DSL
  protocol?: WorkoutProtocol; // Auto-parsed on first access
  isRest?: boolean;
  notes?: string;
}
```

## PlanRunner

The `PlanRunner` tracks execution and compliance:

```typescript
const runner = new PlanRunner(plan);

// Mark sessions as completed or skipped
runner.markCompleted(1);  // Monday done
runner.markSkipped(3);    // Wednesday skipped

// Check progress
const progress = runner.currentProgress;
console.log(progress.complianceRate);  // 0.5 (1 completed, 1 skipped)
console.log(progress.totalCompleted);  // 1
console.log(progress.totalPrescribed); // 12 (3 sessions × 4 weeks)

// Week summary
const week = runner.getWeekSummary();
console.log(`${week.completed}/${week.total} done, ${week.remaining} remaining`);

// Advance to next week
const hasMore = runner.advanceWeek();
if (!hasMore) console.log('Plan complete!');
```

## Multi-Block Periodization

Build a complete periodized program:

```typescript
const plan: TrainingPlan = {
  id: 'marathon-prep',
  name: '16-Week Marathon',
  version: 1,
  blocks: [
    {
      name: 'Base',
      focus: 'Aerobic foundation',
      weeks: [/* 4 weeks of easy running */],
    },
    {
      name: 'Build',
      focus: 'Increase intensity',
      weeks: [/* 4 weeks with tempo runs */],
    },
    {
      name: 'Peak',
      focus: 'Race-specific work',
      weeks: [/* 4 weeks with intervals */],
    },
    {
      name: 'Taper',
      focus: 'Recovery before race',
      weeks: [/* 4 weeks reducing volume */],
    },
  ],
  tags: ['running', 'marathon'],
};
```

The `PlanRunner` automatically advances through blocks when all weeks in a block are completed.

## Integration with AI Planning

Use `@hrkit/ai` to generate plans automatically:

```typescript
import { planNextWeek } from '@hrkit/ai';

const output = await planNextWeek(athleteStore, provider, {
  goal: 'Build aerobic base for 5K',
  daysToplan: 7,
});

// output.sessions contains WorkoutProtocol objects
// which can be converted to a TrainingPlan
```

## Next steps

- **[Workout Protocols](./workout-protocols)** — Define and execute individual structured workouts
- **[Training Load & Insights](./training-load)** — Track ACWR, monotony, and fatigue across plan cycles
