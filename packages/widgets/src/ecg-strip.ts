import { detectRPeaks } from './r-peak.js';

/**
 * <hrkit-ecg-strip> — scrolling raw-ECG strip with overlaid R-peak markers.
 *
 * Attributes:
 *   - sample-rate: Sample rate in Hz (default 130 — Polar H10).
 *   - duration:    Visible window in seconds (default 6).
 *   - theme:       "light" | "dark" (default "dark").
 *   - width / height: pixel size of the canvas.
 *
 * Methods:
 *   - pushSamples(samples: number[]): append raw ECG samples (in microvolts).
 *   - clear(): clear the buffer.
 */
export class HRKitECGStrip extends HTMLElement {
  static observedAttributes = ['sample-rate', 'duration', 'theme', 'width', 'height'];

  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private buffer: number[] = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    shadow.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  }

  connectedCallback(): void {
    this.resize();
    this.draw();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'width' || name === 'height') this.resize();
    this.draw();
  }

  /** Append ECG samples (most recent at the end). */
  pushSamples(samples: number[]): void {
    const fs = this.getNumber('sample-rate', 130);
    const duration = this.getNumber('duration', 6);
    const maxLen = Math.floor(fs * duration);
    this.buffer.push(...samples);
    if (this.buffer.length > maxLen) this.buffer = this.buffer.slice(-maxLen);
    this.draw();
  }

  /** Clear the buffer. */
  clear(): void {
    this.buffer = [];
    this.draw();
  }

  /** Run R-peak detection over the current buffer; useful for tests. */
  detectPeaks(): { peakIndices: number[]; rrIntervals: number[] } {
    const fs = this.getNumber('sample-rate', 130);
    return detectRPeaks(this.buffer, { fs });
  }

  private resize(): void {
    const w = this.getNumber('width', 480);
    const h = this.getNumber('height', 160);
    this.canvas.width = w;
    this.canvas.height = h;
  }

  private getNumber(attr: string, def: number): number {
    const v = this.getAttribute(attr);
    if (v == null) return def;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : def;
  }

  private draw(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const theme = (this.getAttribute('theme') ?? 'dark') === 'dark';
    const bg = theme ? '#0e0e10' : '#ffffff';
    const fg = theme ? '#9bff9b' : '#0a0a0a';
    const peakColor = theme ? '#ff6b6b' : '#c0392b';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (this.buffer.length === 0) return;

    // Auto-scale Y around mean ± 4σ.
    let mean = 0;
    for (const v of this.buffer) mean += v;
    mean /= this.buffer.length;
    let varSum = 0;
    for (const v of this.buffer) varSum += (v - mean) ** 2;
    const std = Math.sqrt(varSum / this.buffer.length) || 1;
    const yMin = mean - 4 * std;
    const yMax = mean + 4 * std;

    const map = (v: number): number => {
      const t = (v - yMin) / (yMax - yMin);
      return h - t * h;
    };

    // ECG trace
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const stepX = w / Math.max(1, this.buffer.length - 1);
    for (let i = 0; i < this.buffer.length; i++) {
      const x = i * stepX;
      const y = map(this.buffer[i]!);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // R-peak markers
    const peaks = this.detectPeaks().peakIndices;
    ctx.fillStyle = peakColor;
    for (const idx of peaks) {
      const x = idx * stepX;
      const y = map(this.buffer[idx]!);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
