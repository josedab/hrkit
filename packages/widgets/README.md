# @hrkit/widgets

Live dashboard Web Components for @hrkit — heart rate gauge, zone bar, and HR chart. Zero dependencies, works in any framework or plain HTML.

## Install

```bash
npm install @hrkit/widgets
# or
pnpm add @hrkit/widgets
```

Or load via CDN:

```html
<script type="module" src="https://unpkg.com/@hrkit/widgets"></script>
```

## Quick Start

Components auto-register when imported. Drop them into any HTML page:

```html
<script type="module">
  import '@hrkit/widgets';
</script>

<hrkit-heart-rate value="142" max-hr="185"></hrkit-heart-rate>
<hrkit-zone-bar zone="4"></hrkit-zone-bar>
<hrkit-hr-chart max-hr="185" duration="60" width="600" height="200"></hrkit-hr-chart>
```

Update values from JavaScript:

```javascript
const gauge = document.querySelector('hrkit-heart-rate');
const zoneBar = document.querySelector('hrkit-zone-bar');
const chart = document.querySelector('hrkit-hr-chart');

// Update on each HR reading
function onHeartRate(hr, zone) {
  gauge.update(hr);
  zoneBar.update(zone);
  chart.addPoint(hr);
}
```

## Components

### `<hrkit-heart-rate>`

Displays the current heart rate with zone-based coloring and a pulse animation.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `number` | — | Current HR in BPM |
| `max-hr` | `number` | `200` | Maximum HR for color scaling |
| `label` | `string` | `"BPM"` | Label text below the value |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Component size |

#### Methods

| Method | Description |
|--------|-------------|
| `update(hr: number)` | Update the displayed heart rate |

---

### `<hrkit-zone-bar>`

Displays a 5-zone bar with the active zone highlighted.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `zone` | `number` | — | Active zone (1–5) |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |
| `show-labels` | `"true" \| "false"` | `"true"` | Show zone number labels |

#### Methods

| Method | Description |
|--------|-------------|
| `update(zone: number)` | Update the active zone |

---

### `<hrkit-hr-chart>`

Scrolling line chart of heart rate over time, colored by zone.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `max-hr` | `number` | `200` | Maximum HR for Y axis |
| `min-hr` | `number` | `40` | Minimum HR for Y axis |
| `duration` | `number` | `60` | Visible time window in seconds |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |
| `width` | `number` | `400` | Chart width in pixels |
| `height` | `number` | `200` | Chart height in pixels |

#### Methods

| Method | Description |
|--------|-------------|
| `addPoint(hr: number, timestamp?: number)` | Add a data point (timestamp defaults to `Date.now()`) |
| `clear()` | Clear all data points |

## CSS Custom Properties

All components support these CSS custom properties for theming:

| Property | Description |
|----------|-------------|
| `--hrkit-bg` | Background color |
| `--hrkit-text` | Text color |
| `--hrkit-accent` | Accent/pulse color (heart rate gauge) |
| `--hrkit-font` | Font family |

```css
/* Example: custom dark theme */
hrkit-heart-rate {
  --hrkit-bg: #0f172a;
  --hrkit-text: #e2e8f0;
  --hrkit-accent: #f43f5e;
  --hrkit-font: 'Inter', sans-serif;
}
```

## Dark Mode

Use the `theme="dark"` attribute on any component:

```html
<hrkit-heart-rate value="155" theme="dark"></hrkit-heart-rate>
<hrkit-zone-bar zone="4" theme="dark"></hrkit-zone-bar>
<hrkit-hr-chart theme="dark"></hrkit-hr-chart>
```

Or toggle programmatically:

```javascript
document.querySelectorAll('[theme]').forEach(el => {
  el.setAttribute('theme', prefersDark ? 'dark' : 'light');
});
```

## Framework Integration

### React

```tsx
import '@hrkit/widgets';
import { useRef, useEffect } from 'react';

function HeartRateDisplay({ hr, zone }: { hr: number; zone: number }) {
  const gaugeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    (gaugeRef.current as any)?.update(hr);
  }, [hr]);

  return (
    <div>
      <hrkit-heart-rate ref={gaugeRef} max-hr="185" theme="dark" />
      <hrkit-zone-bar zone={String(zone)} theme="dark" />
    </div>
  );
}
```

### Vue

```vue
<template>
  <hrkit-heart-rate :value="hr" max-hr="185" theme="dark" />
  <hrkit-zone-bar :zone="zone" theme="dark" />
</template>

<script setup>
import '@hrkit/widgets';
import { ref } from 'vue';

const hr = ref(0);
const zone = ref(1);
</script>
```

## Exported Utilities

```typescript
import { ZONE_COLORS, hrToColor, hrToZone } from '@hrkit/widgets';

ZONE_COLORS[3];            // '#eab308' (yellow)
hrToColor(165, 185);       // zone-based hex color
hrToZone(165, 185);        // 5
```

## License

MIT
