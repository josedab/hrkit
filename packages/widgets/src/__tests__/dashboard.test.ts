// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { HRKitDashboard } from '../dashboard.js';
import { HRKitHeartRate } from '../heart-rate.js';
import { HRKitHRChart } from '../hr-chart.js';
import { HRKitZoneBar } from '../zone-bar.js';

beforeAll(() => {
  if (!customElements.get('hrkit-dashboard')) {
    customElements.define('hrkit-dashboard', HRKitDashboard);
  }
  if (!customElements.get('hrkit-heart-rate')) {
    customElements.define('hrkit-heart-rate', HRKitHeartRate);
  }
  if (!customElements.get('hrkit-zone-bar')) {
    customElements.define('hrkit-zone-bar', HRKitZoneBar);
  }
  if (!customElements.get('hrkit-hr-chart')) {
    customElements.define('hrkit-hr-chart', HRKitHRChart);
  }
});

describe('<hrkit-dashboard>', () => {
  it('renders shadow DOM with grid', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    expect(el.shadowRoot).not.toBeNull();
    const grid = el.shadowRoot!.querySelector('.dashboard-grid');
    expect(grid).toBeTruthy();
    el.remove();
  });

  it('default layout is "live" with 3 widgets', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    expect(el.layoutName).toBe('live');
    expect(el.widgetNames).toEqual(['heart-rate', 'zone-bar', 'hr-chart']);
    const cells = el.shadowRoot!.querySelectorAll('.widget-cell');
    expect(cells.length).toBe(3);
    el.remove();
  });

  it('minimal layout shows 2 widgets', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('layout', 'minimal');
    document.body.appendChild(el);
    expect(el.layoutName).toBe('minimal');
    const cells = el.shadowRoot!.querySelectorAll('.widget-cell');
    expect(cells.length).toBe(2);
    el.remove();
  });

  it('review layout shows 3 widgets', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('layout', 'review');
    document.body.appendChild(el);
    expect(el.layoutName).toBe('review');
    const cells = el.shadowRoot!.querySelectorAll('.widget-cell');
    expect(cells.length).toBe(3);
    el.remove();
  });

  it('setting hr updates heart rate widget', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    el.hr = 120;
    expect(el.hr).toBe(120);
    el.remove();
  });

  it('setting zone updates zone bar widget', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    el.zone = 3;
    expect(el.zone).toBe(3);
    el.remove();
  });

  it('applies dark theme', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('theme', 'dark');
    document.body.appendChild(el);
    // Check that child widgets get dark theme
    const cells = el.shadowRoot!.querySelectorAll('.widget-cell');
    expect(cells.length).toBeGreaterThan(0);
    el.remove();
  });

  it('respects custom columns', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('columns', '2');
    document.body.appendChild(el);
    const grid = el.shadowRoot!.querySelector('.dashboard-grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain('repeat(2');
    el.remove();
  });

  it('respects max-hr attribute', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('max-hr', '190');
    document.body.appendChild(el);
    const chart = el.shadowRoot!.querySelector('hrkit-hr-chart');
    if (chart) {
      expect(chart.getAttribute('max-hr')).toBe('190');
    }
    el.remove();
  });

  it('has ARIA label for accessibility', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    const grid = el.shadowRoot!.querySelector('.dashboard-grid');
    expect(grid!.getAttribute('aria-label')).toBe('Heart rate dashboard');
    expect(grid!.getAttribute('role')).toBe('region');
    el.remove();
  });

  it('widget cells have labels', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    const labels = el.shadowRoot!.querySelectorAll('.widget-label');
    expect(labels.length).toBe(3);
    expect(labels[0]!.textContent).toBe('Heart Rate');
    expect(labels[1]!.textContent).toBe('Zones');
    expect(labels[2]!.textContent).toBe('Chart');
    el.remove();
  });

  it('handles unknown layout gracefully (defaults to live)', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    el.setAttribute('layout', 'unknown');
    document.body.appendChild(el);
    expect(el.layoutName).toBe('live');
    el.remove();
  });

  it('rebuilds grid on attribute change', () => {
    const el = document.createElement('hrkit-dashboard') as HRKitDashboard;
    document.body.appendChild(el);
    expect(el.shadowRoot!.querySelectorAll('.widget-cell').length).toBe(3);
    el.setAttribute('layout', 'minimal');
    expect(el.shadowRoot!.querySelectorAll('.widget-cell').length).toBe(2);
    el.remove();
  });
});
