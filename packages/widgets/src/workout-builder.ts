/**
 * <hrkit-workout-builder> — Interactive workout protocol editor.
 *
 * A web component that produces Workout DSL strings through a visual
 * step editor. Coaches and athletes can add/remove/reorder workout
 * steps, set zone targets and durations, and get valid DSL output.
 *
 * Attributes:
 *   - name: Workout name (default: "Untitled Workout")
 *   - theme: "light" | "dark"
 *
 * Properties:
 *   - value: Current DSL string (read/write)
 *   - steps: Current step list (read-only)
 *
 * Events:
 *   - change: Fired when the DSL changes. detail.dsl contains the DSL string.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type StepType = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface BuilderStep {
  id: string;
  type: StepType;
  durationSec: number;
  zone?: number;
  repeat?: number;
}

// ── Component ───────────────────────────────────────────────────────────

export class HRKitWorkoutBuilder extends HTMLElement {
  static observedAttributes = ['name', 'theme'];

  private shadow: ShadowRoot;
  private _steps: BuilderStep[] = [];
  private _name = 'Untitled Workout';
  private container!: HTMLDivElement;
  private stepList!: HTMLDivElement;
  private outputEl!: HTMLPreElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  connectedCallback(): void {
    this.updateDisplay();
  }

  attributeChangedCallback(name: string, _old: string | null, val: string | null): void {
    if (name === 'name' && val) this._name = val;
    this.updateDisplay();
  }

  /** Get the current DSL string. */
  get value(): string {
    return this.toDSL();
  }

  /** Set the workout from a DSL string (parses step structure). */
  set value(dsl: string) {
    this._steps = this.parseDSL(dsl);
    const nameMatch = /^name:\s*(.+)$/m.exec(dsl);
    if (nameMatch) this._name = nameMatch[1]!.trim();
    this.updateDisplay();
  }

  /** Get current steps (read-only copy). */
  get steps(): readonly BuilderStep[] {
    return [...this._steps];
  }

  /** Add a step to the workout. */
  addStep(type: StepType, durationSec: number, zone?: number): void {
    this._steps.push({
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      durationSec: Math.max(1, durationSec),
      zone: zone != null ? Math.max(1, Math.min(5, zone)) : undefined,
    });
    this.updateDisplay();
    this.emitChange();
  }

  /** Remove a step by index. */
  removeStep(index: number): void {
    if (index >= 0 && index < this._steps.length) {
      this._steps.splice(index, 1);
      this.updateDisplay();
      this.emitChange();
    }
  }

  /** Move a step from one position to another. */
  moveStep(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this._steps.length || toIndex < 0 || toIndex >= this._steps.length) return;
    const [step] = this._steps.splice(fromIndex, 1);
    this._steps.splice(toIndex, 0, step!);
    this.updateDisplay();
    this.emitChange();
  }

  /** Update a step's properties. */
  updateStep(index: number, updates: Partial<Omit<BuilderStep, 'id'>>): void {
    const step = this._steps[index];
    if (!step) return;
    if (updates.type) step.type = updates.type;
    if (updates.durationSec != null) step.durationSec = Math.max(1, updates.durationSec);
    if (updates.zone !== undefined)
      step.zone = updates.zone != null ? Math.max(1, Math.min(5, updates.zone)) : undefined;
    if (updates.repeat !== undefined) step.repeat = updates.repeat;
    this.updateDisplay();
    this.emitChange();
  }

  /** Clear all steps. */
  clear(): void {
    this._steps = [];
    this.updateDisplay();
    this.emitChange();
  }

  /** Set the workout name. */
  setName(name: string): void {
    this._name = name;
    this.setAttribute('name', name);
    this.emitChange();
  }

  /** Total workout duration in seconds. */
  get totalDurationSec(): number {
    return this._steps.reduce((sum, s) => sum + s.durationSec * (s.repeat ?? 1), 0);
  }

  // ── DSL Generation ──────────────────────────────────────────────────

  private toDSL(): string {
    const lines: string[] = [`name: ${this._name}`];
    for (const step of this._steps) {
      let line = `${step.type} ${formatDuration(step.durationSec)}`;
      if (step.zone) line += ` @zone ${step.zone}`;
      if (step.repeat && step.repeat > 1) {
        lines.push(`repeat ${step.repeat}`);
        lines.push(`  ${line}`);
        lines.push('end');
      } else {
        lines.push(line);
      }
    }
    return lines.join('\n');
  }

  private parseDSL(dsl: string): BuilderStep[] {
    const steps: BuilderStep[] = [];
    const lines = dsl
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('name:') && !l.startsWith('desc:'));

    for (const line of lines) {
      if (line.startsWith('repeat') || line === 'end') continue;
      const match = /^(warmup|work|rest|cooldown)\s+(\S+)(?:\s+@zone\s+(\d))?/i.exec(line);
      if (match) {
        steps.push({
          id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: match[1]!.toLowerCase() as StepType,
          durationSec: parseDurationStr(match[2]!),
          zone: match[3] ? Number.parseInt(match[3], 10) : undefined,
        });
      }
    }
    return steps;
  }

  // ── Rendering ─────────────────────────────────────────────────────

  private render(): void {
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
      .container { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
      :host([theme="dark"]) .container { border-color: #374151; background: #1f2937; color: #f9fafb; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .title { font-weight: 600; font-size: 1.1rem; }
      .step { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; margin: 4px 0; }
      .step.warmup { background: #dbeafe; } .step.work { background: #fef3c7; }
      .step.rest { background: #d1fae5; } .step.cooldown { background: #e0e7ff; }
      :host([theme="dark"]) .step.warmup { background: #1e3a5f; }
      :host([theme="dark"]) .step.work { background: #78350f; }
      :host([theme="dark"]) .step.rest { background: #064e3b; }
      :host([theme="dark"]) .step.cooldown { background: #312e81; }
      .step-type { font-weight: 600; text-transform: capitalize; min-width: 70px; }
      .step-duration { font-variant-numeric: tabular-nums; }
      .step-zone { color: #6b7280; font-size: 0.9em; }
      .output { margin-top: 12px; padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 0.85rem; white-space: pre-wrap; font-family: monospace; }
      :host([theme="dark"]) .output { background: #111827; color: #d1d5db; }
      .summary { font-size: 0.85rem; color: #6b7280; margin-top: 8px; }
      .empty { color: #9ca3af; font-style: italic; padding: 12px; text-align: center; }
    `;

    this.container = document.createElement('div');
    this.container.className = 'container';

    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = this._name;
    header.appendChild(title);

    this.stepList = document.createElement('div');
    this.stepList.className = 'step-list';

    this.outputEl = document.createElement('pre');
    this.outputEl.className = 'output';
    this.outputEl.setAttribute('aria-label', 'Workout DSL output');

    this.container.appendChild(header);
    this.container.appendChild(this.stepList);
    this.container.appendChild(this.outputEl);

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.container);
  }

  private updateDisplay(): void {
    if (!this.stepList) return;

    // Update title
    const title = this.container.querySelector('.title');
    if (title) title.textContent = this._name;

    // Clear and rebuild step list
    this.stepList.innerHTML = '';

    if (this._steps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No steps added. Use addStep() to build a workout.';
      this.stepList.appendChild(empty);
    } else {
      for (const step of this._steps) {
        const el = document.createElement('div');
        el.className = `step ${step.type}`;

        const typeEl = document.createElement('span');
        typeEl.className = 'step-type';
        typeEl.textContent = step.type;

        const durEl = document.createElement('span');
        durEl.className = 'step-duration';
        durEl.textContent = formatDuration(step.durationSec);

        el.appendChild(typeEl);
        el.appendChild(durEl);

        if (step.zone) {
          const zoneEl = document.createElement('span');
          zoneEl.className = 'step-zone';
          zoneEl.textContent = `Zone ${step.zone}`;
          el.appendChild(zoneEl);
        }

        if (step.repeat && step.repeat > 1) {
          const repEl = document.createElement('span');
          repEl.className = 'step-zone';
          repEl.textContent = `×${step.repeat}`;
          el.appendChild(repEl);
        }

        this.stepList.appendChild(el);
      }
    }

    // Update DSL output
    if (this.outputEl) {
      this.outputEl.textContent = this._steps.length > 0 ? this.toDSL() : '';
    }
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { dsl: this.toDSL() },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}

function parseDurationStr(s: string): number {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i.exec(s);
  if (!match) {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return (
    Number.parseInt(match[1] ?? '0', 10) * 3600 +
    Number.parseInt(match[2] ?? '0', 10) * 60 +
    Number.parseInt(match[3] ?? '0', 10)
  );
}
