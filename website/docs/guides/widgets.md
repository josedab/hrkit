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
