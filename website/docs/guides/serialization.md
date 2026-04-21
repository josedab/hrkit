---
sidebar_position: 24
title: Session Serialization
description: Save, load, export, and migrate session data (JSON, CSV, TCX).
---

# Session Serialization

@hrkit sessions are in-memory objects. The serialization API lets you persist them as JSON, export to CSV or TCX for analysis tools, and handle schema migrations for forward compatibility.

## JSON round-trip

### Save a session

```typescript
import { sessionToJSON } from '@hrkit/core';

const json = sessionToJSON(session);
localStorage.setItem('last-session', json);
// or write to a file, send to a server, etc.
```

### Load a session

```typescript
import { sessionFromJSON } from '@hrkit/core';

const json = localStorage.getItem('last-session')!;
const session = sessionFromJSON(json);
```

### Options

`sessionFromJSON` accepts an options object for validation and migration:

```typescript
const session = sessionFromJSON(json, {
  strict: true,        // validate every sample (default: false)
  migrators: custom,   // custom version migrators (default: BUILTIN_MIGRATORS)
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `strict` | `false` | Validates every sample in the session. O(n) — use for untrusted input. |
| `migrators` | `BUILTIN_MIGRATORS` | Array of migration functions for upgrading old schemas. |

## CSV export

### Session samples

Export session data as CSV for spreadsheet analysis or data science workflows:

```typescript
import { sessionToCSV } from '@hrkit/core';

const csv = sessionToCSV(session);
console.log(csv);
// timestamp,hr,zone,...
// 1704700800000,142,3,...
```

### Round summaries

If your session uses rounds (e.g., BJJ rolls, boxing rounds, interval sets), export per-round summaries:

```typescript
import { roundsToCSV } from '@hrkit/core';

const csv = roundsToCSV(session);
// round,startTime,endTime,avgHR,maxHR,trimp,...
```

## TCX export

Export sessions in Garmin Training Center XML format for upload to Strava, Garmin Connect, TrainingPeaks, and other platforms:

```typescript
import { sessionToTCX } from '@hrkit/core';

const tcx = sessionToTCX(session);
// Returns a complete TCX XML string
```

### Sport mapping

Pass a `sport` option to set the TCX activity type:

```typescript
const tcx = sessionToTCX(session, { sport: 'Biking' });
// Valid sports: 'Running', 'Biking', 'Other' (default)
```

TCX maps heart rate zones to Garmin training types. Most platforms accept TCX imports and will recalculate their own metrics from the raw HR data.

## Schema versioning & migration

Sessions are versioned to support forward compatibility. When the schema evolves, migrators upgrade old data automatically.

### Current version

```typescript
import { SESSION_SCHEMA_VERSION } from '@hrkit/core';
// SESSION_SCHEMA_VERSION = 1
```

### Built-in migrators

```typescript
import { BUILTIN_MIGRATORS } from '@hrkit/core';
// Array of built-in migration functions (version 0 → 1, etc.)
```

### Manual migration

For advanced use cases, apply migrations directly:

```typescript
import { migrateSession, BUILTIN_MIGRATORS } from '@hrkit/core';

const raw = JSON.parse(oldJson);
const migrated = migrateSession(raw, BUILTIN_MIGRATORS);
// migrated is now at the latest schema version
```

You can also provide custom migrators for your own schema extensions:

```typescript
const customMigrators = [
  ...BUILTIN_MIGRATORS,
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (data) => ({ ...data, myField: 'default', schemaVersion: 2 }),
  },
];

const session = sessionFromJSON(json, { migrators: customMigrators });
```

## Full workflow example

```typescript
import {
  sessionToJSON,
  sessionFromJSON,
  sessionToCSV,
  sessionToTCX,
} from '@hrkit/core';

// 1. Save session
const json = sessionToJSON(session);
localStorage.setItem('session-2024-01-15', json);

// 2. Load it back
const restored = sessionFromJSON(
  localStorage.getItem('session-2024-01-15')!,
  { strict: true }, // validate since storage could be corrupted
);

// 3. Export for analysis
const csv = sessionToCSV(restored);
downloadFile('session.csv', csv);

// 4. Export for Strava
const tcx = sessionToTCX(restored, { sport: 'Other' });
downloadFile('session.tcx', tcx);
```

:::tip
Use `strict: true` when loading sessions from untrusted sources (user uploads, cloud sync, local storage that could be corrupted). It validates every sample but costs O(n). For sessions you serialized yourself in the same app session, `strict: false` is fine.
:::

## Next steps

- **[Session Replay & Annotations](./session-replay)** — Replay serialized sessions at variable speed with annotations
- **[Training Load & Insights](./training-load)** — Analyze exported session data for long-term load trends
- **[API Reference](../reference/core-api)** — Full API documentation for serialization functions
