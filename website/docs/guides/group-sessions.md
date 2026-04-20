---
sidebar_position: 19
title: Group Sessions
description: Multi-athlete live monitoring with zone compliance alerts and coach dashboards.
---

# Group Sessions

`GroupSession` enables live monitoring of multiple athletes simultaneously — ideal for coaching classes, team training, and group fitness. The coach sees everyone's HR, zone, TRIMP, and compliance status in real-time.

## Quick Start

```typescript
import { GroupSession } from '@hrkit/core';

const group = new GroupSession();

// Register athletes
group.addAthlete({ id: 'alice', name: 'Alice', config: { maxHR: 185, restHR: 55, sex: 'female' } });
group.addAthlete({ id: 'bob', name: 'Bob', config: { maxHR: 190, restHR: 60, sex: 'male' } });

// Subscribe to live updates
group.athletes$.subscribe(states => {
  for (const a of states) {
    console.log(`${a.name}: HR=${a.hr} Zone=${a.zone} TRIMP=${a.trimp.toFixed(1)}`);
  }
});

// Feed HR packets from each athlete's connection
group.ingest('alice', alicePacket);
group.ingest('bob', bobPacket);
```

## Zone Compliance Alerts

Set a target zone and get alerts when athletes drift off-target:

```typescript
// Coach sets target zone for the group
group.setTargetZone(3);

// Get athletes who are off-target
const alerts = group.getComplianceAlerts();
for (const alert of alerts) {
  console.log(`⚠️ ${alert.athleteName} is ${alert.direction} target (Zone ${alert.currentZone}, target Zone ${alert.targetZone})`);
}

// Clear target
group.setTargetZone(null);
```

## Leaderboards

Rank athletes by any metric:

```typescript
const board = group.getLeaderboard('trimp');
for (const entry of board) {
  console.log(`#${entry.rank} ${entry.athleteName}: ${entry.value.toFixed(1)}`);
}

// Available metrics: 'hr' (current), 'peakHR', 'trimp'
```

## Zone Heatmap

See how many athletes are in each zone:

```typescript
group.heatmap$.subscribe(heatmap => {
  console.log(`Zone distribution: Z1=${heatmap.zones[1]} Z2=${heatmap.zones[2]} Z3=${heatmap.zones[3]} Z4=${heatmap.zones[4]} Z5=${heatmap.zones[5]}`);
});
```

## Group Statistics

```typescript
group.stats$.subscribe(stats => {
  console.log(`Active: ${stats.activeCount}/${stats.totalCount}`);
  console.log(`Avg HR: ${stats.avgHR}, Max HR: ${stats.maxHR}`);
});
```

## Late-Join Sync

When a new coach/viewer joins mid-session, send them the full state snapshot:

```typescript
// On the server/sender side:
const snapshot = group.snapshot();
sendToNewViewer(JSON.stringify(snapshot));

// Snapshot includes: athletes, heatmap, stats, leaderboard,
// targetZone, complianceAlerts, timestamp
```

## Activity Detection

Athletes are marked `active` if they've sent a packet within the timeout window (default: 5 seconds):

```typescript
const group = new GroupSession({ activityTimeoutSec: 10 });

const state = group.getAthleteState('alice');
if (state && !state.active) {
  console.log(`${state.name} disconnected (last seen ${state.lastSeenAgo}s ago)`);
}
```

## Session End

Retrieve final states for all athletes:

```typescript
const results = group.end();
for (const a of results) {
  console.log(`${a.name}: Peak HR=${a.peakHR}, TRIMP=${a.trimp.toFixed(1)}, packets=${a.packetCount}`);
}
```
