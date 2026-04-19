/**
 * Workout DSL — a tiny line-based parser for protocols and a library of
 * pre-built training protocols (Tabata, MAF, Norwegian 4×4, BJJ rounds).
 *
 * DSL grammar (one statement per line, '#' for comments, blank lines ignored):
 *
 *   name: <protocol name>
 *   desc: <free text>
 *   warmup <secs> [@zone N | @hr MIN-MAX]
 *   work <secs> [@zone N | @hr MIN-MAX]
 *   rest <secs> [@zone N | @hr MIN-MAX]
 *   cooldown <secs> [@zone N | @hr MIN-MAX]
 *   repeat <N>
 *     <indented step lines>
 *   end
 *
 * Time may be `30s`, `5m`, `1h30m`, `90` (defaults to seconds).
 *
 * Example:
 *   name: Tabata
 *   warmup 5m @zone 2
 *   repeat 8
 *     work 20s @zone 5
 *     rest 10s @zone 1
 *   end
 *   cooldown 5m @zone 1
 */

import { ParseError } from './errors.js';
import type { StepTarget, WorkoutProtocol, WorkoutStep } from './workout-protocol.js';

/**
 * Parse a duration string like "30s", "5m", "1h30m", or "90".
 *
 * @param input - Duration string.
 * @returns Duration in seconds.
 *
 * @example
 * ```ts
 * parseDuration('5m');    // 300
 * parseDuration('1h30m'); // 5400
 * parseDuration('90');    // 90
 * ```
 */
export function parseDuration(input: string): number {
  const s = input.trim();
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  let total = 0;
  const re = /(\d+)\s*([hms])/g;
  let matched = false;
  let m: RegExpExecArray | null = re.exec(s);
  while (m !== null) {
    matched = true;
    const n = Number.parseInt(m[1]!, 10);
    const unit = m[2]!;
    if (unit === 'h') total += n * 3600;
    else if (unit === 'm') total += n * 60;
    else total += n;
    m = re.exec(s);
  }
  if (!matched) throw new ParseError(`invalid duration: ${input}`);
  return total;
}

function parseTarget(rest: string): StepTarget | undefined {
  const m1 = /@zone\s+([1-5])/i.exec(rest);
  if (m1) return { zone: Number.parseInt(m1[1]!, 10) as 1 | 2 | 3 | 4 | 5 };
  const m2 = /@hr\s+(\d+)\s*-\s*(\d+)/i.exec(rest);
  if (m2) return { hrRange: [Number.parseInt(m2[1]!, 10), Number.parseInt(m2[2]!, 10)] };
  return undefined;
}

const STEP_KEYWORDS = ['warmup', 'work', 'rest', 'cooldown'] as const;
type StepKeyword = (typeof STEP_KEYWORDS)[number];

function isStepKeyword(s: string): s is StepKeyword {
  return (STEP_KEYWORDS as readonly string[]).includes(s);
}

/**
 * Parse a workout DSL string into a `WorkoutProtocol`.
 *
 * @param text - Workout DSL string.
 * @returns Parsed workout protocol.
 * @throws {Error} If the DSL contains unterminated repeat blocks.
 *
 * @example
 * ```ts
 * const protocol = parseWorkoutDSL(`
 *   name: Tabata
 *   warmup 5m @zone 1
 *   repeat 8
 *     work 20s @zone 5
 *     rest 10s @zone 1
 *   end
 *   cooldown 5m @zone 1
 * `);
 * ```
 */
export function parseWorkoutDSL(text: string): WorkoutProtocol {
  let name = 'Untitled workout';
  let description: string | undefined;
  const steps: WorkoutStep[] = [];

  let inRepeat = false;
  let repeatCount = 0;
  const repeatBuffer: WorkoutStep[] = [];

  const lines = text.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = lines[lineNo]!;
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;

    if (line.startsWith('name:')) {
      name = line.slice('name:'.length).trim();
      continue;
    }
    if (line.startsWith('desc:')) {
      description = line.slice('desc:'.length).trim();
      continue;
    }

    if (/^repeat\s+\d+$/.test(line)) {
      if (inRepeat) throw new ParseError(`nested repeat not supported (line ${lineNo + 1})`);
      const m = /^repeat\s+(\d+)$/.exec(line)!;
      repeatCount = Number.parseInt(m[1]!, 10);
      inRepeat = true;
      repeatBuffer.length = 0;
      continue;
    }

    if (line === 'end') {
      if (!inRepeat) throw new ParseError(`unexpected 'end' (line ${lineNo + 1})`);
      for (let r = 0; r < repeatCount; r++) {
        for (const s of repeatBuffer) steps.push({ ...s });
      }
      inRepeat = false;
      continue;
    }

    const parts = line.split(/\s+/);
    const kw = parts[0]!;
    if (!isStepKeyword(kw)) {
      throw new ParseError(`unknown directive '${kw}' on line ${lineNo + 1}`);
    }
    const dur = parseDuration(parts[1] ?? '');
    const target = parseTarget(parts.slice(2).join(' '));
    const step: WorkoutStep = {
      name: kw[0]!.toUpperCase() + kw.slice(1),
      type: kw,
      durationSec: dur,
    };
    if (target) step.target = target;

    if (inRepeat) repeatBuffer.push(step);
    else steps.push(step);
  }

  if (inRepeat) throw new ParseError("unterminated 'repeat' block");

  return description !== undefined ? { name, description, steps } : { name, steps };
}

/**
 * Serialize a WorkoutProtocol back to DSL text.
 *
 * @param p - Workout protocol to serialize.
 * @returns DSL string.
 *
 * @example
 * ```ts
 * const dsl = workoutToDSL(protocol);
 * console.log(dsl);
 * // name: Tabata
 * // warmup 300s @zone 1
 * // work 20s @zone 5
 * // ...
 * ```
 */
export function workoutToDSL(p: WorkoutProtocol): string {
  const lines: string[] = [`name: ${p.name}`];
  if (p.description) lines.push(`desc: ${p.description}`);
  for (const s of p.steps) {
    let line = `${s.type} ${s.durationSec}s`;
    if (s.target?.zone) line += ` @zone ${s.target.zone}`;
    else if (s.target?.hrRange) line += ` @hr ${s.target.hrRange[0]}-${s.target.hrRange[1]}`;
    lines.push(line);
  }
  return lines.join('\n');
}

// ── Pre-built protocol library ──────────────────────────────────────────

/** Tabata: 8 × (20 s work / 10 s rest) ≈ 4 min. */
export const TABATA: WorkoutProtocol = parseWorkoutDSL(`
name: Tabata
desc: Classic Tabata interval (20s on / 10s off, 8 rounds)
warmup 5m @zone 2
repeat 8
  work 20s @zone 5
  rest 10s @zone 1
end
cooldown 3m @zone 1
`);

/** Maffetone Aerobic Base — steady 45 min in zone 2. */
export const MAF_45: WorkoutProtocol = parseWorkoutDSL(`
name: MAF 45
desc: Maffetone aerobic base — 45 min steady at MAF HR (zone 2)
warmup 10m @zone 1
work 45m @zone 2
cooldown 5m @zone 1
`);

/** Norwegian 4×4: four 4-minute intervals in zone 5 with 3-minute zone-2 recoveries. */
export const NORWEGIAN_4X4: WorkoutProtocol = parseWorkoutDSL(`
name: Norwegian 4x4
desc: 4 x 4 min @ 90-95% HRmax with 3 min active recovery
warmup 10m @zone 2
repeat 4
  work 4m @zone 5
  rest 3m @zone 2
end
cooldown 5m @zone 1
`);

/** BJJ rolling rounds — 5 × 6-minute rounds with 1-minute rest. */
export const BJJ_ROUNDS: WorkoutProtocol = parseWorkoutDSL(`
name: BJJ Rounds
desc: 5 x 6 min sparring rounds with 1 min rest
warmup 10m @zone 2
repeat 5
  work 6m @zone 4
  rest 1m @zone 2
end
cooldown 5m @zone 1
`);

/** All built-in protocols, keyed by name. */
export const PROTOCOL_LIBRARY: Record<string, WorkoutProtocol> = {
  Tabata: TABATA,
  'MAF 45': MAF_45,
  'Norwegian 4x4': NORWEGIAN_4X4,
  'BJJ Rounds': BJJ_ROUNDS,
};

// ── Audio cues ──────────────────────────────────────────────────────────

/** Browser SpeechSynthesis-like interface used by `WorkoutCues`. */
export interface SpeakLike {
  speak: (text: string) => void;
  cancel?: () => void;
}

/** SpeechSynthesisUtterance constructor (for browser environments). */
export interface UtteranceCtor {
  new (text: string): { rate: number; volume: number; pitch: number; lang: string };
}

/**
 * Adapter that reads workout step transitions aloud via the Web Speech API,
 * a Capacitor TTS plugin, or any custom `SpeakLike`. Pure utility — does
 * not directly require the DOM, so it can be unit tested with a stub.
 *
 * @example
 * ```ts
 * const cues = new WorkoutCues({ speak: (t) => console.log(t) });
 * cues.announceStep(protocol.steps[0], 0);
 * ```
 */
export class WorkoutCues {
  private readonly speaker: SpeakLike;
  private readonly countdownAt: number[];
  private spokenForStep = new Set<number>();

  constructor(speaker: SpeakLike, opts: { countdownAt?: number[] } = {}) {
    this.speaker = speaker;
    this.countdownAt = opts.countdownAt ?? [3, 2, 1];
  }

  /** Call when a new step begins. */
  announceStep(step: WorkoutStep, indexInProtocol: number): void {
    this.spokenForStep.clear();
    this.spokenForStep.add(indexInProtocol);
    const target = step.target?.zone
      ? `, target zone ${step.target.zone}`
      : step.target?.hrRange
        ? `, target ${step.target.hrRange[0]} to ${step.target.hrRange[1]} BPM`
        : '';
    this.speaker.speak(`${step.name} for ${formatDuration(step.durationSec)}${target}`);
  }

  /** Call every tick (e.g., once per second). Will say "3", "2", "1" near the end. */
  tick(secondsRemaining: number, stepIndex: number): void {
    const key = stepIndex * 1000 + secondsRemaining;
    if (this.spokenForStep.has(key)) return;
    if (this.countdownAt.includes(secondsRemaining)) {
      this.spokenForStep.add(key);
      this.speaker.speak(String(secondsRemaining));
    }
  }

  /** Stop any in-flight utterance. */
  cancel(): void {
    this.speaker.cancel?.();
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${m} minute${m === 1 ? '' : 's'} ${s} seconds`;
}

/**
 * Browser convenience: build a `WorkoutCues` instance backed by
 * `window.speechSynthesis`. Returns `null` if the API is unavailable.
 *
 * @param opts - Optional speech configuration.
 * @returns WorkoutCues instance, or null if Speech Synthesis is unavailable.
 *
 * @example
 * ```ts
 * const cues = createBrowserCues({ rate: 1.1, lang: 'en-US' });
 * if (cues) engine.step$.subscribe(e => cues.announceStep(e.step, e.index));
 * ```
 */
export function createBrowserCues(opts: { rate?: number; volume?: number; lang?: string } = {}): WorkoutCues | null {
  type SpeechGlobal = {
    speechSynthesis?: { speak: (u: unknown) => void; cancel: () => void };
    SpeechSynthesisUtterance?: UtteranceCtor;
  };
  const w = (globalThis as { window?: SpeechGlobal }).window;
  const synth = w?.speechSynthesis;
  const Utt = w?.SpeechSynthesisUtterance;
  if (!synth || !Utt) return null;
  const speaker: SpeakLike = {
    speak(text: string) {
      const u = new Utt(text);
      u.rate = opts.rate ?? 1;
      u.volume = opts.volume ?? 1;
      u.pitch = 1;
      u.lang = opts.lang ?? 'en-US';
      synth.speak(u);
    },
    cancel() {
      synth.cancel();
    },
  };
  return new WorkoutCues(speaker);
}
