// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { hrToColor, hrToZone, ZONE_COLORS } from '../colors.js';
import { HRKitHeartRate } from '../heart-rate.js';
import { HRKitHRChart } from '../hr-chart.js';
import { HRKitZoneBar } from '../zone-bar.js';

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
});
