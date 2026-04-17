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
});
