---
title: "@hrkit/integrations"
description: "Third-party integrations for @hrkit — FIT export and Strava/Garmin/TrainingPeaks/Intervals.icu uploaders"
---

# @hrkit/integrations

Third-party integrations for @hrkit — FIT export and Strava/Garmin/TrainingPeaks/Intervals.icu uploaders

## Install

```bash
pnpm add @hrkit/integrations
```

## Key features

- **FIT / TCX export** — convert sessions to standard fitness file formats
- **HealthKit export** — Apple Health integration for iOS apps
- **Strava uploader** — push activities to Strava via OAuth
- **Garmin Connect** — upload to Garmin Connect
- **Intervals.icu / TrainingPeaks** — sync with advanced training platforms

## Quick example

```typescript
import { uploadToStrava } from '@hrkit/integrations';

await uploadToStrava(session, {
  accessToken: process.env.STRAVA_TOKEN!,
  activityName: 'Morning BJJ',
  activityType: 'Workout',
});
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/integrations#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/integrations`](https://github.com/josedab/hrkit/tree/main/packages/integrations) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/integrations)
