/**
 * <hrkit-breath-pacer> — animated breathing guide for HRV biofeedback.
 *
 * Attributes:
 * - bpm: breathing rate in breaths per minute (default 6)
 * - inhale-ratio: fraction of cycle for inhale (default 0.5)
 * - running: "true" to animate, omit/empty to pause
 * - score: optional 0..1 coherence score; renders a small dot indicator
 *
 * Methods:
 * - start(), stop(), setBpm(bpm), setScore(score)
 */
export class HRKitBreathPacer extends HTMLElement {
  static observedAttributes = ['bpm', 'inhale-ratio', 'running', 'score'];

  private shadow: ShadowRoot;
  private circle!: HTMLDivElement;
  private label!: HTMLDivElement;
  private dot!: HTMLDivElement;
  private animFrame: number | null = null;
  private startedAt = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback(): void {
    if (this.getAttribute('running') === 'true') this.start();
    this.refresh();
  }

  disconnectedCallback(): void {
    this.stop();
  }

  attributeChangedCallback(name: string, _o: string | null, n: string | null): void {
    if (name === 'running') {
      if (n === 'true') this.start();
      else this.stop();
    } else {
      this.refresh();
    }
  }

  start(): void {
    if (this.animFrame !== null) return;
    this.startedAt = performance.now();
    const tick = (t: number) => {
      this.tickAnim(t);
      this.animFrame = requestAnimationFrame(tick);
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.circle) this.circle.style.transform = 'scale(1)';
    if (this.label) this.label.textContent = 'Paused';
  }

  setBpm(bpm: number): void {
    this.setAttribute('bpm', String(bpm));
  }

  setScore(score: number): void {
    this.setAttribute('score', String(score));
  }

  private get bpm(): number {
    const v = Number.parseFloat(this.getAttribute('bpm') ?? '6');
    return Number.isFinite(v) && v > 0 ? v : 6;
  }

  private get inhaleRatio(): number {
    const v = Number.parseFloat(this.getAttribute('inhale-ratio') ?? '0.5');
    return Number.isFinite(v) && v > 0 && v < 1 ? v : 0.5;
  }

  private tickAnim(t: number): void {
    const periodMs = 60000 / this.bpm;
    const phase = ((t - this.startedAt) % periodMs) / periodMs; // 0..1
    const inhale = this.inhaleRatio;
    let scale: number;
    let label: string;
    if (phase < inhale) {
      const p = phase / inhale;
      scale = 0.5 + 0.5 * p;
      label = 'Inhale';
    } else {
      const p = (phase - inhale) / (1 - inhale);
      scale = 1 - 0.5 * p;
      label = 'Exhale';
    }
    if (this.circle) this.circle.style.transform = `scale(${scale.toFixed(3)})`;
    if (this.label) this.label.textContent = label;
  }

  private refresh(): void {
    if (!this.dot) return;
    const score = Number.parseFloat(this.getAttribute('score') ?? 'NaN');
    if (Number.isFinite(score)) {
      const hue = Math.round(score * 120); // red→green
      this.dot.style.background = `hsl(${hue}, 80%, 50%)`;
      this.dot.title = `coherence ${(score * 100).toFixed(0)}%`;
    }
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; --hrkit-pacer-color: #4f8cff; --hrkit-pacer-bg: transparent; }
      .wrap { position: relative; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; background: var(--hrkit-pacer-bg); }
      .circle {
        width: 200px; height: 200px; border-radius: 50%;
        background: radial-gradient(circle, var(--hrkit-pacer-color) 0%, transparent 70%);
        transition: transform 80ms linear;
        transform-origin: center;
      }
      .label {
        position: absolute; font: 600 1.1rem/1 system-ui, -apple-system, sans-serif;
        color: var(--hrkit-text, #fff); text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      .dot {
        position: absolute; top: 8px; right: 8px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #888; box-shadow: 0 0 4px rgba(0,0,0,0.3);
      }
    `;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    this.circle = document.createElement('div');
    this.circle.className = 'circle';
    this.label = document.createElement('div');
    this.label.className = 'label';
    this.label.textContent = 'Ready';
    this.dot = document.createElement('div');
    this.dot.className = 'dot';
    wrap.appendChild(this.circle);
    wrap.appendChild(this.label);
    wrap.appendChild(this.dot);
    this.shadow.appendChild(style);
    this.shadow.appendChild(wrap);
  }
}
