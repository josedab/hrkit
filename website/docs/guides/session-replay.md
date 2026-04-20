---
sidebar_position: 17
title: Session Replay & Annotations
description: Replay recorded sessions at variable speed with coach annotations.
---

# Session Replay & Annotations

The `SessionPlayer` replays a recorded session by emitting samples at configurable speed (0.25x–8x). Coaches can annotate moments of interest for review.

## Quick Start

```typescript
import { SessionPlayer } from '@hrkit/core';

const player = new SessionPlayer(session);

// Subscribe to replay events
player.sample$.subscribe(event => {
  console.log(`[${event.index}/${event.total}] HR: ${event.sample.hr} (${(event.progress * 100).toFixed(0)}%)`);
});

// State changes
player.state$.subscribe(state => console.log(`State: ${state}`));

// Play at 4x speed
player.play(4);
```

## Playback Controls

```typescript
player.play(2);           // Start or resume at 2x speed
player.pause();            // Pause playback
player.stop();             // Stop and reset to beginning
player.setSpeed(4);        // Change speed without pausing
player.seekToIndex(50);    // Jump to sample index 50
player.seekToTime(ts);     // Jump to a timestamp
player.dispose();          // Release resources
```

### Playback States

| State | Description |
|-------|-------------|
| `idle` | Initial state, or after `stop()` |
| `playing` | Actively emitting samples |
| `paused` | Frozen mid-session |
| `completed` | All samples emitted |

Calling `play()` after `completed` restarts from the beginning.

## Annotations

Add coach notes at specific timestamps:

```typescript
// Add annotation at a specific session timestamp
const ann = player.addAnnotation(
  session.startTime + 120000,  // 2 minutes in
  'Great technique — maintain this hip escape form',
  { type: 'highlight', author: 'Coach Mike' }
);

// Remove
player.removeAnnotation(ann.id);

// Query annotations in a time range
const range = player.getAnnotationsInRange(
  session.startTime + 60000,
  session.startTime + 180000,
);
```

### Annotation Types

| Type | Use Case |
|------|----------|
| `note` | General observation (default) |
| `highlight` | Positive moment worth reviewing |
| `issue` | Problem to address in training |
| `technique` | Technique-specific feedback |

## Replay Event Structure

```typescript
interface ReplayEvent {
  sample: TimestampedHR;  // The HR sample
  index: number;          // Current sample index
  total: number;          // Total samples
  speed: number;          // Current playback speed
  progress: number;       // 0–1 fraction
  elapsedMs: number;      // Session time elapsed
  totalMs: number;        // Total session duration
}
```

## Coaching Workflow

```typescript
// 1. Load a session
const session = sessionFromJSON(savedJSON);
const player = new SessionPlayer(session);

// 2. Play at high speed to find interesting moments
player.play(8);

// 3. When something catches your eye, pause and annotate
player.pause();
player.addAnnotation(
  player.currentSampleIndex,
  'HR spike during guard recovery — investigate fatigue',
  { type: 'issue' }
);

// 4. Resume or seek to another point
player.play(4);

// 5. Export annotations with the session
const annotations = player.allAnnotations;
```
