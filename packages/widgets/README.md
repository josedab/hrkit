# @hrkit/widgets

Live dashboard Web Components for @hrkit — heart rate gauge, zone bar, scrolling HR chart, raw-ECG strip with R-peak overlay, and a breathing pacer for HRV biofeedback. Zero dependencies, works in any framework or plain HTML.

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
<hrkit-ecg-strip sample-rate="130" duration="6" width="600" height="160"></hrkit-ecg-strip>
<hrkit-breath-pacer bpm="6" running="true"></hrkit-breath-pacer>
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

---

### `<hrkit-ecg-strip>`

Scrolling raw-ECG strip with overlaid R-peak markers — pairs naturally with `@hrkit/polar` ECG streams (130 Hz on the Polar H10).

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample-rate` | `number` | `130` | ECG sample rate in Hz (Polar H10 = 130) |
| `duration` | `number` | `6` | Visible window in seconds |
| `theme` | `"light" \| "dark"` | `"dark"` | Color theme |
| `width` | `number` | `400` | Canvas width in pixels |
| `height` | `number` | `200` | Canvas height in pixels |

#### Methods

| Method | Description |
|--------|-------------|
| `pushSamples(samples: number[])` | Append raw ECG samples (microvolts) |
| `clear()` | Clear the buffer |

R-peaks are detected internally with the same `detectRPeaks` algorithm exported below.

---

### `<hrkit-breath-pacer>`

Animated breathing guide for HRV biofeedback — a smoothly expanding/contracting circle paced at a configurable BPM, with an optional coherence-score indicator dot.

#### Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `bpm` | `number` | `6` | Breathing rate in breaths per minute |
| `inhale-ratio` | `number` | `0.5` | Fraction of each cycle spent inhaling (0..1) |
| `running` | `"true" \| ""` | `""` | `"true"` to animate; omit/empty to pause |
| `score` | `number` | — | Optional 0..1 coherence score; renders as a small dot indicator |

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the animation |
| `stop()` | Pause the animation |
| `setBpm(bpm: number)` | Update the breathing rate |
| `setScore(score: number)` | Update the coherence indicator |

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
import {
  ZONE_COLORS,
  hrToColor,
  hrToZone,
  detectRPeaks,
  registerAll,
  SDK_NAME,
  SDK_VERSION,
} from '@hrkit/widgets';

// Color helpers
ZONE_COLORS[3];            // '#eab308' (yellow)
hrToColor(165, 185);       // zone-based hex color
hrToZone(165, 185);        // 5

// Pan-Tompkins-style R-peak detection — pure utility, no DOM required.
const { peakIndices, rrIntervals } = detectRPeaks(ecgSamples, {
  fs: 130,                 // sample rate in Hz (Polar H10 default)
  refractorySec: 0.2,      // minimum gap between peaks
});

// Components are auto-registered on import. Call manually only when
// using lazy loading or a custom registration order.
registerAll();             // idempotent — safe to call repeatedly

console.log(SDK_NAME, SDK_VERSION);
```

> The package's top-level `import '@hrkit/widgets'` calls `registerAll()` for you — defining `<hrkit-heart-rate>`, `<hrkit-zone-bar>`, `<hrkit-hr-chart>`, `<hrkit-ecg-strip>` and `<hrkit-breath-pacer>` on `customElements`. If you tree-shake at the symbol level (importing only `detectRPeaks`, say) you may need to call `registerAll()` explicitly before instantiating elements.

## License

MIT
