import { hrToColor } from './colors.js';

/**
 * <hrkit-heart-rate> Web Component — displays current BPM with pulse animation.
 *
 * Attributes:
 * - value: Current HR in BPM (number)
 * - max-hr: Maximum HR for color scaling (default: 200)
 * - label: Optional label text (default: "BPM")
 * - theme: "light" or "dark" (default: "light")
 * - size: "sm", "md", "lg" (default: "md")
 *
 * Methods:
 * - update(value: number): Update the displayed heart rate
 *
 * CSS Custom Properties:
 * - --hrkit-bg: Background color
 * - --hrkit-text: Text color
 * - --hrkit-accent: Accent/pulse color
 * - --hrkit-font: Font family
 */
export class HRKitHeartRate extends HTMLElement {
  static observedAttributes = ['value', 'max-hr', 'label', 'theme', 'size'];

  private shadow: ShadowRoot;
  private valueEl!: HTMLSpanElement;
  private labelEl!: HTMLSpanElement;
  private containerEl!: HTMLDivElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback(): void {
    this.refresh();
  }

  attributeChangedCallback(_name: string, _oldValue: string | null, _newValue: string | null): void {
    this.refresh();
  }

  /** Update the displayed value. @param value - New value to display. */
  update(hr: number): void {
    this.setAttribute('value', String(hr));
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-block;
        font-family: var(--hrkit-font, system-ui, -apple-system, sans-serif);
      }
      .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        padding: 16px 24px;
        background: var(--hrkit-bg, #f8f9fa);
        color: var(--hrkit-text, #1a1a1a);
        transition: background 0.3s;
      }
      .container.dark {
        background: var(--hrkit-bg, #1a1a1a);
        color: var(--hrkit-text, #f8f9fa);
      }
      .container.sm { padding: 8px 12px; }
      .container.md { padding: 16px 24px; }
      .container.lg { padding: 24px 36px; }
      .value {
        font-size: 3em;
        font-weight: 700;
        line-height: 1;
        transition: color 0.3s;
      }
      .container.sm .value { font-size: 1.5em; }
      .container.lg .value { font-size: 4.5em; }
      .label {
        font-size: 0.875em;
        opacity: 0.7;
        margin-top: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      .pulsing .value {
        animation: pulse var(--pulse-speed, 0.8s) ease-in-out infinite;
      }
    `;

    const container = document.createElement('div');
    container.className = 'container md';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', '-- beats per minute');

    const valueSpan = document.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = '--';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = 'BPM';

    container.appendChild(valueSpan);
    container.appendChild(labelSpan);

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);

    this.containerEl = container;
    this.valueEl = valueSpan;
    this.labelEl = labelSpan;
  }

  private refresh(): void {
    if (!this.containerEl) return;

    const hr = Number(this.getAttribute('value') ?? 0);
    const maxHR = Number(this.getAttribute('max-hr') ?? 200);
    const label = this.getAttribute('label') ?? 'BPM';
    const theme = this.getAttribute('theme') ?? 'light';
    const size = this.getAttribute('size') ?? 'md';

    this.valueEl.textContent = hr > 0 ? String(hr) : '--';
    this.labelEl.textContent = label;

    const ariaValue = hr > 0 ? `${hr} beats per minute` : '-- beats per minute';
    this.containerEl.setAttribute('aria-label', ariaValue);

    this.containerEl.className = `container ${size}${theme === 'dark' ? ' dark' : ''}${hr > 0 ? ' pulsing' : ''}`;

    if (hr > 0) {
      this.valueEl.style.color = `var(--hrkit-accent, ${hrToColor(hr, maxHR)})`;
      // Faster pulse at higher HR: map 40-200 bpm → 1.2s-0.4s
      const speed = Math.max(0.4, 1.2 - ((hr - 40) / 160) * 0.8);
      this.containerEl.style.setProperty('--pulse-speed', `${speed}s`);
    } else {
      this.valueEl.style.color = '';
      this.containerEl.style.removeProperty('--pulse-speed');
    }
  }
}
