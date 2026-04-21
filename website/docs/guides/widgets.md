---
sidebar_position: 8
title: Dashboard Widgets
description: Drop-in Web Components for live heart rate display with @hrkit/widgets.
---

# Dashboard Widgets

`@hrkit/widgets` provides zero-dependency Web Components for live HR dashboards. Works in any framework (React, Vue, Svelte, Angular) or plain HTML.

## Install

```bash
npm install @hrkit/widgets
```

Or via CDN:

```html
<script type="module" src="https://unpkg.com/@hrkit/widgets"></script>
```

## Quick Start

Components auto-register when imported:

```html
<script type="module">
  import '@hrkit/widgets';
</script>

<hrkit-heart-rate value="142" max-hr="185"></hrkit-heart-rate>
<hrkit-zone-bar zone="4"></hrkit-zone-bar>
<hrkit-hr-chart max-hr="185" duration="60" width="600" height="200"></hrkit-hr-chart>
```

Update from JavaScript:

```javascript
const gauge = document.querySelector('hrkit-heart-rate');
const zoneBar = document.querySelector('hrkit-zone-bar');
const chart = document.querySelector('hrkit-hr-chart');

function onHeartRate(hr, zone) {
  gauge.update(hr);
  zoneBar.update(zone);
  chart.addPoint(hr);
}
```

## Components

### `<hrkit-heart-rate>`

Displays the current heart rate with zone-based coloring and a pulse animation.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | number | — | Current HR in BPM |
| `max-hr` | number | 200 | Max HR for color scaling |
| `label` | string | "BPM" | Label below the value |
| `theme` | "light" \| "dark" | "light" | Color theme |
| `size` | "sm" \| "md" \| "lg" | "md" | Component size |

**Method:** `update(hr: number)` — update the displayed heart rate.

### `<hrkit-zone-bar>`

Displays a 5-zone bar with the active zone highlighted.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `zone` | number | — | Active zone (1–5) |
| `theme` | "light" \| "dark" | "light" | Color theme |
| `show-labels` | "true" \| "false" | "true" | Show zone numbers |

**Method:** `update(zone: number)` — update the active zone.

### `<hrkit-hr-chart>`

Scrolling line chart of heart rate over time, colored by zone.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `max-hr` | number | 200 | Y axis max |
| `min-hr` | number | 40 | Y axis min |
| `duration` | number | 60 | Visible window (seconds) |
| `width` | number | 400 | Chart width (px) |
| `height` | number | 200 | Chart height (px) |
| `theme` | "light" \| "dark" | "light" | Color theme |

**Methods:** `addPoint(hr, timestamp?)`, `clear()`.

## Theming

All components support CSS custom properties:

```css
hrkit-heart-rate {
  --hrkit-bg: #0f172a;
  --hrkit-text: #e2e8f0;
  --hrkit-accent: #f43f5e;
  --hrkit-font: 'Inter', sans-serif;
}
```

Or use the `theme="dark"` attribute:

```html
<hrkit-heart-rate value="155" theme="dark"></hrkit-heart-rate>
```

## Framework Integration

### React

```tsx
import '@hrkit/widgets';
import { useRef, useEffect } from 'react';

function HeartRateDisplay({ hr }: { hr: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { (ref.current as any)?.update(hr); }, [hr]);
  return <hrkit-heart-rate ref={ref} max-hr="185" theme="dark" />;
}
```

### Vue

```vue
<template>
  <hrkit-heart-rate :value="hr" max-hr="185" theme="dark" />
</template>
<script setup>
import '@hrkit/widgets';
import { ref } from 'vue';
const hr = ref(0);
</script>
```

## Connecting to @hrkit/core

```typescript
import '@hrkit/widgets';
import { SessionRecorder, connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const gauge = document.querySelector('hrkit-heart-rate')!;
const chart = document.querySelector('hrkit-hr-chart')!;

const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });
recorder.hr$.subscribe((hr) => {
  (gauge as any).update(hr);
  (chart as any).addPoint(hr);
});
```

## Utilities

```typescript
import { ZONE_COLORS, hrToColor, hrToZone } from '@hrkit/widgets';

ZONE_COLORS[3];            // '#eab308'
hrToColor(165, 185);       // zone-based hex color
hrToZone(165, 185);        // 5
```

## `<hrkit-workout-builder>`

Interactive workout protocol editor that produces [Workout DSL](/docs/guides/workout-protocols) strings.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | "Untitled Workout" | Workout name |
| `theme` | "light" \| "dark" | "light" | Color theme |

**Properties:**
- `value` — get/set the current DSL string
- `steps` — read-only array of current steps
- `totalDurationSec` — total duration including repeats

**Methods:**
- `addStep(type, durationSec, zone?)` — add a warmup/work/rest/cooldown step
- `removeStep(index)` — remove by index
- `moveStep(from, to)` — reorder steps
- `updateStep(index, updates)` — modify step properties
- `clear()` — remove all steps
- `setName(name)` — update workout name

**Events:**
- `change` — fires when the DSL changes. `event.detail.dsl` contains the DSL string.

```typescript
const builder = document.querySelector('hrkit-workout-builder');
builder.addStep('warmup', 300, 1);
builder.addStep('work', 20, 5);
builder.updateStep(1, { repeat: 8 });
builder.addStep('cooldown', 300, 1);

console.log(builder.value);
// name: Untitled Workout
// warmup 5m @zone 1
// repeat 8
//   work 20s @zone 5
// end
// cooldown 5m @zone 1

builder.addEventListener('change', e => {
  console.log('DSL updated:', e.detail.dsl);
});
```

## `<hrkit-dashboard>`

Zero-config analytics dashboard that renders a grid of widgets with a single `session` property.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `layout` | "live" \| "review" \| "minimal" | "live" | Preset layout |
| `theme` | "light" \| "dark" | "light" | Color theme |
| `max-hr` | number | 200 | Max HR for child widgets |
| `columns` | number | auto | Grid column count |

**Properties:**
- `hr` — set current heart rate (updates HR gauge + chart)
- `zone` — set current zone (updates zone bar)

**Preset Layouts:**

| Layout | Widgets |
|--------|---------|
| `live` | Heart rate + Zone bar + HR chart |
| `review` | Heart rate + Zone bar + HR chart |
| `minimal` | Heart rate + Zone bar |

```html
<!-- Drop-in live dashboard — no wiring needed -->
<hrkit-dashboard layout="live" theme="dark" max-hr="190"></hrkit-dashboard>

<script type="module">
  const dashboard = document.querySelector('hrkit-dashboard');

  // Update from your HR source
  for await (const packet of conn.heartRate()) {
    dashboard.hr = packet.hr;
    dashboard.zone = hrToZone(packet.hr, zoneConfig);
  }
</script>
```

## Theming

All components support CSS custom properties for brand customization:

```css
hrkit-dashboard {
  --hrkit-dashboard-bg: #1a1a2e;
  --hrkit-cell-bg: #16213e;
}

hrkit-heart-rate {
  --hrkit-text: #f0f0f0;
}

hrkit-breath-pacer {
  --hrkit-pacer-color: #4f8cff;
  --hrkit-pacer-bg: transparent;
}
```

## Next steps

- **[Streaming Server](./server)** — Feed live data to widgets over WebSocket or SSE
- **[Streaming Metrics](./streaming-metrics)** — Compute real-time HRV and TRIMP alongside widget display
- **[API Reference](../reference/core-api)** — Full API documentation for all core functions
