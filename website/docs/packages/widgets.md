---
title: "@hrkit/widgets"
description: "Live dashboard Web Components for @hrkit — heart rate gauge, zone bar, HR chart"
---

# @hrkit/widgets

Live dashboard Web Components for @hrkit — heart rate gauge, zone bar, HR chart

## Install

```bash
pnpm add @hrkit/widgets
```

## Key features

- **HR gauge** — real-time heart rate dial with zone coloring
- **Zone bar** — horizontal zone distribution visualization
- **HR chart** — scrolling time-series heart rate graph
- **ECG strip** — live ECG waveform display (with `@hrkit/polar`)
- **Breath pacer** — guided breathing animation
- **Workout builder** — visual interval/round editor
- **Full dashboard** — composite `<hrkit-dashboard>` combining all widgets
- **Standalone** — no framework dependency, works with any HTML page

## Quick example

```html
<script type="module">
  import { registerAll } from '@hrkit/widgets';
  registerAll();
</script>

<hrkit-dashboard></hrkit-dashboard>

<script>
  const dashboard = document.querySelector('hrkit-dashboard');
  // Push live HR data
  dashboard.update({ heartRate: 145, zone: 3 });
</script>
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/widgets#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/widgets`](https://github.com/josedab/hrkit/tree/main/packages/widgets) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/widgets)
