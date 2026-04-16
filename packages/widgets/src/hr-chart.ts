import { hrToColor } from './colors.js';

interface DataPoint {
  hr: number;
  time: number;
}

/**
 * <hrkit-hr-chart> Web Component — scrolling time-series heart rate chart.
 *
 * Attributes:
 * - max-hr: Maximum HR for Y axis (default: 200)
 * - min-hr: Minimum HR for Y axis (default: 40)
 * - duration: Visible time window in seconds (default: 60)
 * - theme: "light" or "dark"
 * - width: Chart width in pixels (default: 400)
 * - height: Chart height in pixels (default: 200)
 *
 * Methods:
 * - addPoint(hr: number, timestamp?: number): Add a data point
 * - clear(): Clear all data points
 */
export class HRKitHRChart extends HTMLElement {
  static observedAttributes = [
    'max-hr',
    'min-hr',
    'duration',
    'theme',
    'width',
    'height',
  ];

  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private points: DataPoint[] = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.buildDOM(shadow);
  }

  connectedCallback(): void {
    this.resizeCanvas();
    this.draw();
  }

  attributeChangedCallback(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    if (_name === 'width' || _name === 'height') {
      this.resizeCanvas();
    }
    this.draw();
  }

  /**
   * Add a data point to the chart.
   *
   * @param hr - Heart rate value.
   * @param timestamp - Optional Unix timestamp (defaults to Date.now()).
   */
  addPoint(hr: number, timestamp?: number): void {
    const time = timestamp ?? Date.now();
    this.points.push({ hr, time });
    this.prunePoints();
    this.draw();
  }

  /** Clear all data points from the chart. */
  clear(): void {
    this.points = [];
    this.draw();
  }

  private get maxHR(): number {
    return Number(this.getAttribute('max-hr') ?? 200);
  }

  private get minHR(): number {
    return Number(this.getAttribute('min-hr') ?? 40);
  }

  private get durationMs(): number {
    return Number(this.getAttribute('duration') ?? 60) * 1000;
  }

  private get chartWidth(): number {
    return Number(this.getAttribute('width') ?? 400);
  }

  private get chartHeight(): number {
    return Number(this.getAttribute('height') ?? 200);
  }

  private get isDark(): boolean {
    return this.getAttribute('theme') === 'dark';
  }

  private buildDOM(shadow: ShadowRoot): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; }
      canvas {
        border-radius: 8px;
        background: var(--hrkit-bg, #f8f9fa);
      }
      :host([theme="dark"]) canvas {
        background: var(--hrkit-bg, #1a1a1a);
      }
    `;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Heart rate chart');
    this.ctx = this.canvas.getContext('2d');

    shadow.appendChild(style);
    shadow.appendChild(this.canvas);
  }

  private resizeCanvas(): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1;
    this.canvas.width = this.chartWidth * dpr;
    this.canvas.height = this.chartHeight * dpr;
    this.canvas.style.width = `${this.chartWidth}px`;
    this.canvas.style.height = `${this.chartHeight}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private prunePoints(): void {
    if (this.points.length === 0) return;
    const cutoff = this.points[this.points.length - 1]!.time - this.durationMs;
    const idx = this.points.findIndex((p) => p.time >= cutoff);
    if (idx > 0) this.points.splice(0, idx);
  }

  private draw(): void {
    if (!this.ctx) return;
    const w = this.chartWidth;
    const h = this.chartHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    const pad = { top: 10, right: 10, bottom: 20, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const textColor = this.isDark ? '#9ca3af' : '#6b7280';
    const gridColor = this.isDark ? '#374151' : '#e5e7eb';

    // Y-axis labels + grid
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const steps = 4;
    const range = this.maxHR - this.minHR;
    for (let i = 0; i <= steps; i++) {
      const val = this.minHR + (range * i) / steps;
      const y = pad.top + plotH - (plotH * i) / steps;

      ctx.fillStyle = textColor;
      ctx.fillText(String(Math.round(val)), pad.left - 6, y);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    if (this.points.length < 2) return;

    const latest = this.points[this.points.length - 1]!.time;
    const earliest = latest - this.durationMs;

    const toX = (t: number): number =>
      pad.left + ((t - earliest) / this.durationMs) * plotW;
    const toY = (hr: number): number => {
      const clamped = Math.max(this.minHR, Math.min(this.maxHR, hr));
      return pad.top + plotH - ((clamped - this.minHR) / range) * plotH;
    };

    // Draw line segments colored by zone
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1]!;
      const cur = this.points[i]!;

      ctx.strokeStyle = hrToColor(cur.hr, this.maxHR);
      ctx.beginPath();
      ctx.moveTo(toX(prev.time), toY(prev.hr));
      ctx.lineTo(toX(cur.time), toY(cur.hr));
      ctx.stroke();
    }
  }
}
