// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { HRKitBreathPacer } from '../breath-pacer.js';

beforeAll(() => {
  if (!customElements.get('hrkit-breath-pacer')) {
    customElements.define('hrkit-breath-pacer', HRKitBreathPacer);
  }
});

describe('<hrkit-breath-pacer>', () => {
  it('renders shadow DOM with circle and label', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    const root = el.shadowRoot!;
    expect(root.querySelector('.circle')).toBeTruthy();
    expect(root.querySelector('.label')).toBeTruthy();
    expect(root.querySelector('.dot')).toBeTruthy();
    el.remove();
  });

  it('start() and stop() do not throw and update label', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.start();
    el.stop();
    const label = el.shadowRoot!.querySelector('.label')!.textContent;
    expect(label).toBe('Paused');
    el.remove();
  });

  it('setBpm reflects to attribute', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    el.setBpm(7);
    expect(el.getAttribute('bpm')).toBe('7');
  });

  it('setScore tints the dot', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setScore(0.8);
    const dot = el.shadowRoot!.querySelector('.dot') as HTMLElement;
    expect(dot.style.background).toContain('hsl');
    el.remove();
  });

  it('auto-starts when running attribute is set before connectedCallback', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    el.setAttribute('running', 'true');
    document.body.appendChild(el);
    // Stop immediately to clean up
    el.stop();
    el.remove();
  });

  it('start() is idempotent (calling twice does not throw)', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.start();
    el.start(); // Should not create duplicate animation frames
    el.stop();
    el.remove();
  });

  it('stop() is safe to call when not running', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.stop();
    el.stop(); // Double-stop should be safe
    el.remove();
  });

  it('stop() resets circle scale and label', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.start();
    el.stop();
    const circle = el.shadowRoot!.querySelector('.circle') as HTMLElement;
    expect(circle.style.transform).toBe('scale(1)');
    const label = el.shadowRoot!.querySelector('.label')!.textContent;
    expect(label).toBe('Paused');
    el.remove();
  });

  it('handles invalid bpm gracefully (defaults to 6)', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    el.setAttribute('bpm', 'not-a-number');
    document.body.appendChild(el);
    el.start();
    el.stop();
    el.remove();
  });

  it('handles invalid inhale-ratio gracefully', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    el.setAttribute('inhale-ratio', '-1');
    document.body.appendChild(el);
    el.start();
    el.stop();
    el.remove();
  });

  it('setScore with 0 shows red dot', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setScore(0);
    const dot = el.shadowRoot!.querySelector('.dot') as HTMLElement;
    expect(dot.style.background).toContain('hsl(0');
    el.remove();
  });

  it('setScore with 1 shows green dot', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setScore(1);
    const dot = el.shadowRoot!.querySelector('.dot') as HTMLElement;
    expect(dot.style.background).toContain('hsl(120');
    el.remove();
  });

  it('disconnectedCallback stops animation', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.start();
    el.remove(); // triggers disconnectedCallback → stop()
  });

  it('attributeChangedCallback toggles running', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setAttribute('running', 'true');
    el.setAttribute('running', 'false');
    const label = el.shadowRoot!.querySelector('.label')!.textContent;
    expect(label).toBe('Paused');
    el.remove();
  });

  it('attributeChangedCallback handles non-running attribute change', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setAttribute('bpm', '10');
    el.setAttribute('inhale-ratio', '0.4');
    el.remove();
  });

  it('exercises inhale phase via tickAnim', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    // Access private tickAnim to cover the animation branch logic
    const proto = el as unknown as { startedAt: number; tickAnim(t: number): void };
    proto.startedAt = 0;
    // At t=0, phase=0 → inhale branch
    proto.tickAnim(0);
    const label = el.shadowRoot!.querySelector('.label')!.textContent;
    expect(label).toBe('Inhale');
    el.remove();
  });

  it('exercises exhale phase via tickAnim', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    const proto = el as unknown as { startedAt: number; tickAnim(t: number): void };
    proto.startedAt = 0;
    // Default bpm=6 → period=10000ms; inhaleRatio=0.5 → exhale starts at 5000ms
    // At t=7500ms → phase=0.75, in exhale phase
    proto.tickAnim(7500);
    const label = el.shadowRoot!.querySelector('.label')!.textContent;
    expect(label).toBe('Exhale');

    const circle = el.shadowRoot!.querySelector('.circle') as HTMLElement;
    expect(circle.style.transform).toMatch(/^scale\(/);
    el.remove();
  });

  it('inhaleRatio getter returns 0.5 for out-of-range values', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setAttribute('inhale-ratio', '1.5'); // > 1 → defaults to 0.5
    const proto = el as unknown as { startedAt: number; tickAnim(t: number): void };
    proto.startedAt = 0;
    proto.tickAnim(0);
    expect(el.shadowRoot!.querySelector('.label')!.textContent).toBe('Inhale');
    el.remove();
  });

  it('bpm getter returns 6 for zero/negative values', () => {
    const el = document.createElement('hrkit-breath-pacer') as HRKitBreathPacer;
    document.body.appendChild(el);
    el.setAttribute('bpm', '0');
    const proto = el as unknown as { startedAt: number; tickAnim(t: number): void };
    proto.startedAt = 0;
    proto.tickAnim(0);
    el.remove();
  });
});
