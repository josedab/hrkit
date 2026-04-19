/**
 * <hrkit-dashboard> — Configurable analytics dashboard component.
 *
 * Renders a grid of @hrkit widgets with a single `session` property.
 * Supports preset layouts and theming for zero-config integration.
 *
 * Attributes:
 *   - layout: Preset layout name ("live", "review", "minimal"). Default: "live".
 *   - theme: "light" | "dark"
 *   - max-hr: Maximum HR for zone calculation (default: 200)
 *   - columns: Number of grid columns (default: auto)
 *
 * Properties:
 *   - hr: Set current heart rate (for live layout)
 *   - zone: Set current zone (1-5)
 *   - session: Set a full session for review layout
 */

// ── Types ───────────────────────────────────────────────────────────────

export type DashboardLayout = 'live' | 'review' | 'minimal';

interface LayoutConfig {
  widgets: string[];
  columns: number;
}

const LAYOUTS: Record<DashboardLayout, LayoutConfig> = {
  live: {
    widgets: ['heart-rate', 'zone-bar', 'hr-chart'],
    columns: 3,
  },
  review: {
    widgets: ['heart-rate', 'zone-bar', 'hr-chart'],
    columns: 3,
  },
  minimal: {
    widgets: ['heart-rate', 'zone-bar'],
    columns: 2,
  },
};

// ── Component ───────────────────────────────────────────────────────────

export class HRKitDashboard extends HTMLElement {
  static observedAttributes = ['layout', 'theme', 'max-hr', 'columns'];

  private shadow: ShadowRoot;
  private grid!: HTMLDivElement;
  private widgets = new Map<string, HTMLElement>();
  private _hr = 0;
  private _zone: number = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.buildDOM();
  }

  connectedCallback(): void {
    this.rebuildGrid();
  }

  attributeChangedCallback(): void {
    this.rebuildGrid();
  }

  /** Set the current heart rate (live mode). */
  set hr(value: number) {
    this._hr = value;
    const hrWidget = this.widgets.get('heart-rate');
    if (hrWidget && 'update' in hrWidget) {
      (hrWidget as HTMLElement & { update(v: number): void }).update(value);
    }
    const chartWidget = this.widgets.get('hr-chart');
    if (chartWidget && 'addPoint' in chartWidget) {
      (chartWidget as HTMLElement & { addPoint(hr: number): void }).addPoint(value);
    }
  }

  get hr(): number {
    return this._hr;
  }

  /** Set the current zone (1-5). */
  set zone(value: number) {
    this._zone = value;
    const zoneWidget = this.widgets.get('zone-bar');
    if (zoneWidget && 'update' in zoneWidget) {
      (zoneWidget as HTMLElement & { update(v: number): void }).update(value);
    }
  }

  get zone(): number {
    return this._zone;
  }

  /** Get the current layout name. */
  get layoutName(): DashboardLayout {
    const attr = this.getAttribute('layout');
    if (attr === 'review' || attr === 'minimal') return attr;
    return 'live';
  }

  /** Get widget names in the current layout. */
  get widgetNames(): string[] {
    return LAYOUTS[this.layoutName].widgets;
  }

  private get maxHR(): number {
    return Number(this.getAttribute('max-hr') ?? 200);
  }

  private get isDark(): boolean {
    return this.getAttribute('theme') === 'dark';
  }

  private get columnCount(): number {
    const attr = this.getAttribute('columns');
    if (attr) {
      const n = Number.parseInt(attr, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return LAYOUTS[this.layoutName].columns;
  }

  private buildDOM(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; }
      .dashboard-grid {
        display: grid;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        background: var(--hrkit-dashboard-bg, #f8f9fa);
      }
      :host([theme="dark"]) .dashboard-grid {
        background: var(--hrkit-dashboard-bg, #1a1a2e);
      }
      .widget-cell {
        border-radius: 8px;
        padding: 8px;
        background: var(--hrkit-cell-bg, #fff);
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      :host([theme="dark"]) .widget-cell {
        background: var(--hrkit-cell-bg, #16213e);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      .widget-label {
        font: 500 0.75rem/1 system-ui, sans-serif;
        color: #6b7280;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      :host([theme="dark"]) .widget-label { color: #9ca3af; }
    `;

    this.grid = document.createElement('div');
    this.grid.className = 'dashboard-grid';
    this.grid.setAttribute('role', 'region');
    this.grid.setAttribute('aria-label', 'Heart rate dashboard');

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.grid);
  }

  private rebuildGrid(): void {
    if (!this.grid) return;

    this.grid.innerHTML = '';
    this.widgets.clear();
    this.grid.style.gridTemplateColumns = `repeat(${this.columnCount}, 1fr)`;

    const layout = LAYOUTS[this.layoutName];
    const theme = this.isDark ? 'dark' : 'light';

    for (const widgetName of layout.widgets) {
      const cell = document.createElement('div');
      cell.className = 'widget-cell';

      const label = document.createElement('div');
      label.className = 'widget-label';
      label.textContent = WIDGET_LABELS[widgetName] ?? widgetName;
      cell.appendChild(label);

      const tagName = `hrkit-${widgetName}`;
      const widget = document.createElement(tagName);
      widget.setAttribute('theme', theme);

      if (widgetName === 'hr-chart') {
        widget.setAttribute('max-hr', String(this.maxHR));
        widget.setAttribute('width', '300');
        widget.setAttribute('height', '150');
      }

      this.widgets.set(widgetName, widget);
      cell.appendChild(widget);
      this.grid.appendChild(cell);
    }
  }
}

const WIDGET_LABELS: Record<string, string> = {
  'heart-rate': 'Heart Rate',
  'zone-bar': 'Zones',
  'hr-chart': 'Chart',
  'ecg-strip': 'ECG',
  'breath-pacer': 'Breathing',
};
