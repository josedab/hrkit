// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hrToColor, hrToZone, ZONE_COLORS } from '../colors.js';
import { HRKitHeartRate } from '../heart-rate.js';
import { HRKitHRChart } from '../hr-chart.js';
import { registerAll } from '../index.js';
import { HRKitZoneBar } from '../zone-bar.js';

// Stub canvas context for happy-dom (which lacks Canvas 2D support)
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const noop = () => {};
const stubCtx = {
  clearRect: noop,
  fillRect: noop,
  fillText: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  arc: noop,
  fill: noop,
  setTransform: noop,
  set fillStyle(_v: string) {},
  set strokeStyle(_v: string) {},
  set lineWidth(_v: number) {},
  set lineJoin(_v: string) {},
  set lineCap(_v: string) {},
  set font(_v: string) {},
  set textAlign(_v: string) {},
  set textBaseline(_v: string) {},
};

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (id: string) {
    if (id === '2d') return stubCtx as unknown as CanvasRenderingContext2D;
    return originalGetContext.call(this, id) as ReturnType<HTMLCanvasElement['getContext']>;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('ZONE_COLORS', () => {
  it('has entries for zones 1 through 5', () => {
    expect(Object.keys(ZONE_COLORS)).toHaveLength(5);
    for (let z = 1; z <= 5; z++) {
      expect(ZONE_COLORS[z]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('hrToColor', () => {
  it('returns blue for low HR', () => {
    expect(hrToColor(60, 200)).toBe('#3b82f6');
  });

  it('returns green at 50-60% maxHR', () => {
    expect(hrToColor(110, 200)).toBe('#22c55e');
  });

  it('returns yellow at 60-70% maxHR', () => {
    expect(hrToColor(130, 200)).toBe('#eab308');
  });

  it('returns orange at 70-80% maxHR', () => {
    expect(hrToColor(150, 200)).toBe('#f97316');
  });

  it('returns red at 80-90% maxHR', () => {
    expect(hrToColor(170, 200)).toBe('#ef4444');
  });

  it('returns deep red at ≥90% maxHR', () => {
    expect(hrToColor(190, 200)).toBe('#dc2626');
  });

  it('handles zero maxHR gracefully', () => {
    expect(hrToColor(100, 0)).toBe(ZONE_COLORS[1]);
  });

  it('handles negative maxHR gracefully', () => {
    expect(hrToColor(100, -10)).toBe(ZONE_COLORS[1]);
  });
});

describe('hrToZone', () => {
  it('maps low HR to zone 1', () => {
    expect(hrToZone(80, 200)).toBe(1);
  });

  it('maps 50-60% to zone 2', () => {
    expect(hrToZone(110, 200)).toBe(2);
  });

  it('maps 60-70% to zone 3', () => {
    expect(hrToZone(130, 200)).toBe(3);
  });

  it('maps 70-80% to zone 4', () => {
    expect(hrToZone(150, 200)).toBe(4);
  });

  it('maps ≥80% to zone 5', () => {
    expect(hrToZone(170, 200)).toBe(5);
  });

  it('handles zero maxHR', () => {
    expect(hrToZone(100, 0)).toBe(1);
  });
});

// ── DOM rendering tests ───────────────────────────────────────────────

// Register custom elements once before all DOM tests
if (!customElements.get('hrkit-heart-rate')) {
  customElements.define('hrkit-heart-rate', HRKitHeartRate);
}
if (!customElements.get('hrkit-zone-bar')) {
  customElements.define('hrkit-zone-bar', HRKitZoneBar);
}
if (!customElements.get('hrkit-hr-chart')) {
  customElements.define('hrkit-hr-chart', HRKitHRChart);
}

describe('HRKitHeartRate component', () => {
  it('renders with shadow DOM', () => {
    const el = document.createElement('hrkit-heart-rate') as HRKitHeartRate;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    const value = el.shadowRoot!.querySelector('.value');
    expect(value).not.toBeNull();
    expect(value!.textContent).toBe('--');

    document.body.removeChild(el);
  });

  it('updates value via attribute', () => {
    const el = document.createElement('hrkit-heart-rate') as HRKitHeartRate;
    document.body.appendChild(el);

    el.setAttribute('value', '150');
    const value = el.shadowRoot!.querySelector('.value');
    expect(value!.textContent).toBe('150');

    document.body.removeChild(el);
  });

  it('update() method sets attribute', () => {
    const el = document.createElement('hrkit-heart-rate') as HRKitHeartRate;
    document.body.appendChild(el);

    el.update(120);
    expect(el.getAttribute('value')).toBe('120');

    document.body.removeChild(el);
  });

  it('applies dark theme', () => {
    const el = document.createElement('hrkit-heart-rate') as HRKitHeartRate;
    el.setAttribute('theme', 'dark');
    document.body.appendChild(el);

    const container = el.shadowRoot!.querySelector('.container');
    expect(container!.classList.contains('dark')).toBe(true);

    document.body.removeChild(el);
  });

  it('has ARIA attributes for accessibility', () => {
    const el = document.createElement('hrkit-heart-rate') as HRKitHeartRate;
    document.body.appendChild(el);
    el.setAttribute('value', '72');

    const container = el.shadowRoot!.querySelector('.container');
    expect(container!.getAttribute('role')).toBe('status');
    expect(container!.getAttribute('aria-live')).toBe('polite');

    document.body.removeChild(el);
  });
});

describe('HRKitZoneBar component', () => {
  it('renders 5 zone segments', () => {
    const el = document.createElement('hrkit-zone-bar') as HRKitZoneBar;
    document.body.appendChild(el);

    const segments = el.shadowRoot!.querySelectorAll('.segment');
    expect(segments.length).toBe(5);

    document.body.removeChild(el);
  });

  it('highlights active zone', () => {
    const el = document.createElement('hrkit-zone-bar') as HRKitZoneBar;
    el.setAttribute('zone', '3');
    document.body.appendChild(el);

    const segments = el.shadowRoot!.querySelectorAll('.segment');
    const activeSegment = segments[2];
    expect(activeSegment).toBeDefined();
    expect(activeSegment!.classList.contains('active')).toBe(true);

    document.body.removeChild(el);
  });

  it('update() method changes zone', () => {
    const el = document.createElement('hrkit-zone-bar') as HRKitZoneBar;
    document.body.appendChild(el);

    el.update(4);
    expect(el.getAttribute('zone')).toBe('4');

    document.body.removeChild(el);
  });
});

describe('HRKitHRChart component', () => {
  it('renders canvas element', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    const canvas = el.shadowRoot!.querySelector('canvas');
    expect(canvas).not.toBeNull();

    document.body.removeChild(el);
  });

  it('clear() removes all data', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    el.addPoint(150);
    el.addPoint(160);
    el.clear();
    el.addPoint(140);

    document.body.removeChild(el);
  });

  it('addPoint with timestamp does not throw', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    const now = Date.now();
    el.addPoint(60, now);
    el.addPoint(70, now + 1000);
    el.addPoint(80, now + 2000);

    document.body.removeChild(el);
  });

  it('draws multiple points (exercises line drawing path)', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      el.addPoint(60 + i * 5, now + i * 1000);
    }

    document.body.removeChild(el);
  });

  it('respects max-hr and min-hr attributes', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    el.setAttribute('max-hr', '220');
    el.setAttribute('min-hr', '30');
    document.body.appendChild(el);

    el.addPoint(50);
    el.addPoint(200);

    expect(el.getAttribute('max-hr')).toBe('220');
    expect(el.getAttribute('min-hr')).toBe('30');
    document.body.removeChild(el);
  });

  it('applies dark theme', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    el.setAttribute('theme', 'dark');
    document.body.appendChild(el);

    const now = Date.now();
    el.addPoint(100, now);
    el.addPoint(120, now + 1000);
    el.addPoint(140, now + 2000);

    document.body.removeChild(el);
  });

  it('handles width and height attribute changes', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    el.setAttribute('width', '800');
    el.setAttribute('height', '400');

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('400px');

    document.body.removeChild(el);
  });

  it('handles duration attribute', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    el.setAttribute('duration', '30');
    document.body.appendChild(el);

    const now = Date.now();
    // Add points spanning more than 30 seconds to trigger pruning
    for (let i = 0; i < 40; i++) {
      el.addPoint(60 + (i % 60), now + i * 1000);
    }

    document.body.removeChild(el);
  });

  it('canvas has aria-label for accessibility', () => {
    const el = document.createElement('hrkit-hr-chart') as HRKitHRChart;
    document.body.appendChild(el);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('aria-label')).toBe('Heart rate chart');
    expect(canvas.getAttribute('role')).toBe('img');

    document.body.removeChild(el);
  });
});

describe('registerAll', () => {
  it('is idempotent — calling multiple times does not throw', () => {
    registerAll();
    registerAll();
    expect(customElements.get('hrkit-heart-rate')).toBeDefined();
    expect(customElements.get('hrkit-zone-bar')).toBeDefined();
    expect(customElements.get('hrkit-hr-chart')).toBeDefined();
    expect(customElements.get('hrkit-ecg-strip')).toBeDefined();
    expect(customElements.get('hrkit-breath-pacer')).toBeDefined();
  });
});
