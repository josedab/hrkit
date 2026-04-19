// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { HRKitWorkoutBuilder } from '../workout-builder.js';

beforeAll(() => {
  if (!customElements.get('hrkit-workout-builder')) {
    customElements.define('hrkit-workout-builder', HRKitWorkoutBuilder);
  }
});

describe('<hrkit-workout-builder>', () => {
  it('renders shadow DOM', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.container')).toBeTruthy();
    el.remove();
  });

  it('starts with empty steps', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    expect(el.steps).toHaveLength(0);
    expect(el.totalDurationSec).toBe(0);
    el.remove();
  });

  it('addStep adds a step and emits DSL', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300, 1);
    expect(el.steps).toHaveLength(1);
    expect(el.steps[0]!.type).toBe('warmup');
    expect(el.steps[0]!.durationSec).toBe(300);
    expect(el.steps[0]!.zone).toBe(1);
    expect(el.value).toContain('warmup 5m @zone 1');
    el.remove();
  });

  it('removeStep removes by index', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300);
    el.addStep('work', 600, 3);
    el.removeStep(0);
    expect(el.steps).toHaveLength(1);
    expect(el.steps[0]!.type).toBe('work');
    el.remove();
  });

  it('removeStep handles out-of-range gracefully', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300);
    el.removeStep(-1);
    el.removeStep(5);
    expect(el.steps).toHaveLength(1);
    el.remove();
  });

  it('moveStep reorders steps', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300);
    el.addStep('work', 600);
    el.addStep('cooldown', 300);
    el.moveStep(2, 0); // move cooldown to start
    expect(el.steps[0]!.type).toBe('cooldown');
    expect(el.steps[1]!.type).toBe('warmup');
    el.remove();
  });

  it('moveStep handles invalid indices', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300);
    el.moveStep(-1, 0);
    el.moveStep(0, 5);
    expect(el.steps).toHaveLength(1);
    el.remove();
  });

  it('updateStep modifies step properties', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300, 1);
    el.updateStep(0, { durationSec: 600, zone: 2 });
    expect(el.steps[0]!.durationSec).toBe(600);
    expect(el.steps[0]!.zone).toBe(2);
    el.remove();
  });

  it('updateStep clamps zone to 1-5', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('work', 300);
    el.updateStep(0, { zone: 7 });
    expect(el.steps[0]!.zone).toBe(5);
    el.updateStep(0, { zone: 0 });
    expect(el.steps[0]!.zone).toBe(1);
    el.remove();
  });

  it('clear removes all steps', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300);
    el.addStep('work', 600);
    el.clear();
    expect(el.steps).toHaveLength(0);
    el.remove();
  });

  it('setName updates the workout name', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.setName('My Workout');
    el.addStep('work', 300);
    expect(el.value).toContain('name: My Workout');
    el.remove();
  });

  it('totalDurationSec calculates correctly', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.addStep('warmup', 300);
    el.addStep('work', 600);
    el.addStep('cooldown', 300);
    expect(el.totalDurationSec).toBe(1200);
  });

  it('value setter parses DSL', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.value = 'name: Tabata\nwarmup 5m @zone 1\nwork 20s @zone 5\nrest 10s @zone 1\ncooldown 5m @zone 1';
    expect(el.steps).toHaveLength(4);
    expect(el.steps[0]!.type).toBe('warmup');
    expect(el.steps[0]!.durationSec).toBe(300);
    expect(el.steps[1]!.type).toBe('work');
    expect(el.steps[1]!.durationSec).toBe(20);
    el.remove();
  });

  it('value roundtrip preserves structure', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.addStep('warmup', 300, 1);
    el.addStep('work', 1200, 3);
    el.addStep('cooldown', 300, 1);
    const dsl = el.value;
    expect(dsl).toContain('warmup 5m @zone 1');
    expect(dsl).toContain('work 20m @zone 3');
    expect(dsl).toContain('cooldown 5m @zone 1');
  });

  it('fires change event on addStep', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    let firedDSL = '';
    el.addEventListener('change', ((e: CustomEvent) => {
      firedDSL = e.detail.dsl;
    }) as EventListener);
    el.addStep('work', 60, 2);
    expect(firedDSL).toContain('work 1m @zone 2');
    el.remove();
  });

  it('renders step elements in shadow DOM', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    el.addStep('warmup', 300, 1);
    el.addStep('work', 600, 3);
    const steps = el.shadowRoot!.querySelectorAll('.step');
    expect(steps.length).toBe(2);
    el.remove();
  });

  it('shows empty state when no steps', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    document.body.appendChild(el);
    const empty = el.shadowRoot!.querySelector('.empty');
    expect(empty).toBeTruthy();
    el.remove();
  });

  it('duration formatting handles seconds and minutes', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.addStep('work', 30);
    expect(el.value).toContain('30s');
    el.addStep('work', 90);
    expect(el.value).toContain('1m30s');
  });

  it('respects theme attribute', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.setAttribute('theme', 'dark');
    document.body.appendChild(el);
    expect(el.getAttribute('theme')).toBe('dark');
    el.remove();
  });

  it('handles repeat in DSL output', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.addStep('work', 20, 5);
    el.updateStep(0, { repeat: 8 });
    const dsl = el.value;
    expect(dsl).toContain('repeat 8');
    expect(dsl).toContain('work 20s @zone 5');
    expect(dsl).toContain('end');
  });

  it('totalDurationSec accounts for repeats', () => {
    const el = document.createElement('hrkit-workout-builder') as HRKitWorkoutBuilder;
    el.addStep('work', 20, 5);
    el.updateStep(0, { repeat: 4 });
    expect(el.totalDurationSec).toBe(80); // 20s * 4
  });
});
