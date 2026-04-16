import { ZONE_COLORS } from './colors.js';

/**
 * <hrkit-zone-bar> Web Component — horizontal bar showing current HR zone.
 *
 * Attributes:
 * - zone: Current zone (1-5)
 * - theme: "light" or "dark"
 * - show-labels: Show zone number labels (default: "true")
 *
 * Methods:
 * - update(zone: number): Update the active zone
 */
export class HRKitZoneBar extends HTMLElement {
  static observedAttributes = ['zone', 'theme', 'show-labels'];

  private shadow: ShadowRoot;
  private segments: HTMLDivElement[] = [];

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
  update(zone: number): void {
    this.setAttribute('zone', String(zone));
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        font-family: var(--hrkit-font, system-ui, -apple-system, sans-serif);
      }
      .bar {
        display: flex;
        gap: 3px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--hrkit-bg, #e5e7eb);
        padding: 4px;
      }
      .bar.dark {
        background: var(--hrkit-bg, #374151);
      }
      .segment {
        flex: 1;
        height: 32px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75em;
        font-weight: 600;
        color: #fff;
        opacity: 0.35;
        transition: opacity 0.3s, transform 0.2s;
      }
      .segment.active {
        opacity: 1;
        transform: scaleY(1.15);
      }
    `;

    const bar = document.createElement('div');
    bar.className = 'bar';

    for (let z = 1; z <= 5; z++) {
      const seg = document.createElement('div');
      seg.className = 'segment';
      seg.style.background = ZONE_COLORS[z]!;
      seg.dataset.zone = String(z);
      seg.textContent = String(z);
      seg.setAttribute('role', 'meter');
      seg.setAttribute('aria-label', `Zone ${z}`);
      bar.appendChild(seg);
      this.segments.push(seg);
    }

    this.shadow.appendChild(style);
    this.shadow.appendChild(bar);
  }

  private refresh(): void {
    if (this.segments.length === 0) return;

    const zone = Number(this.getAttribute('zone') ?? 0);
    const theme = this.getAttribute('theme') ?? 'light';
    const showLabels = this.getAttribute('show-labels') !== 'false';

    const bar = this.segments[0]!.parentElement;
    if (bar) {
      bar.className = `bar${theme === 'dark' ? ' dark' : ''}`;
    }

    for (const seg of this.segments) {
      const z = Number(seg.dataset.zone);
      const isActive = z === zone;
      seg.classList.toggle('active', isActive);
      seg.textContent = showLabels ? String(z) : '';
      if (isActive) {
        seg.setAttribute('aria-current', 'true');
      } else {
        seg.removeAttribute('aria-current');
      }
    }
  }
}
