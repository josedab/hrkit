/**
 * Session replay engine with annotation support.
 *
 * Replays a recorded {@link Session} by emitting packets at configurable
 * speed (1x–8x), driving any consumer (widgets, analytics, exports)
 * from historical data.
 *
 * Annotations let coaches mark moments of interest during review.
 */

import { SimpleStream } from './stream.js';
import type { Session, TimestampedHR } from './types.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface Annotation {
  /** Unique annotation ID. */
  id: string;
  /** Session timestamp this annotation refers to (ms since epoch). */
  timestamp: number;
  /** Annotation text. */
  text: string;
  /** Optional category for filtering. */
  type?: 'note' | 'highlight' | 'issue' | 'technique';
  /** Who created this annotation. */
  author?: string;
  /** When the annotation was created (ms since epoch). */
  createdAt: number;
}

export type ReplayState = 'idle' | 'playing' | 'paused' | 'completed';

export interface ReplayEvent {
  /** Current sample being emitted. */
  sample: TimestampedHR;
  /** Index into the session's samples array. */
  index: number;
  /** Total samples in the session. */
  total: number;
  /** Current playback speed. */
  speed: number;
  /** Progress as fraction (0–1). */
  progress: number;
  /** Elapsed session time in ms. */
  elapsedMs: number;
  /** Total session duration in ms. */
  totalMs: number;
}

// ── Session Player ──────────────────────────────────────────────────────

/**
 * Replay a recorded session at configurable speed.
 *
 * @example
 * ```ts
 * const player = new SessionPlayer(session);
 * player.sample$.subscribe(event => updateUI(event.sample));
 * player.play(2); // 2x speed
 * ```
 */
export class SessionPlayer {
  /** Emits each sample as it's replayed. */
  readonly sample$ = new SimpleStream<ReplayEvent>();
  /** Emits state changes (idle → playing → paused → completed). */
  readonly state$ = new SimpleStream<ReplayState>();

  private state: ReplayState = 'idle';
  private currentIndex = 0;
  private speed = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private annotations: Annotation[] = [];

  constructor(private readonly session: Session) {}

  /** Current playback state. */
  get currentState(): ReplayState {
    return this.state;
  }

  /** Current sample index. */
  get currentSampleIndex(): number {
    return this.currentIndex;
  }

  /** All annotations on this session. */
  get allAnnotations(): readonly Annotation[] {
    return this.annotations;
  }

  /**
   * Start or resume playback.
   *
   * @param speed - Playback speed multiplier (1–8). Default: 1.
   */
  play(speed = 1): void {
    this.speed = Math.max(0.25, Math.min(8, speed));
    if (this.state === 'completed') {
      this.currentIndex = 0;
    }
    this.setState('playing');
    this.scheduleNext();
  }

  /** Pause playback. */
  pause(): void {
    if (this.state !== 'playing') return;
    this.clearTimer();
    this.setState('paused');
  }

  /** Stop playback and reset to beginning. */
  stop(): void {
    this.clearTimer();
    this.currentIndex = 0;
    this.setState('idle');
  }

  /**
   * Seek to a specific position.
   *
   * @param index - Sample index to seek to.
   */
  seekToIndex(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.session.samples.length - 1));
    if (this.state === 'completed') {
      this.setState('paused');
    }
    this.emitCurrent();
  }

  /**
   * Seek to a specific timestamp.
   *
   * @param timestamp - Session timestamp in ms.
   */
  seekToTime(timestamp: number): void {
    const idx = this.session.samples.findIndex((s) => s.timestamp >= timestamp);
    if (idx >= 0) this.seekToIndex(idx);
  }

  /** Change playback speed without pausing. */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(8, speed));
    if (this.state === 'playing') {
      this.clearTimer();
      this.scheduleNext();
    }
  }

  /**
   * Add an annotation to the session.
   *
   * @param timestamp - Session timestamp this annotation refers to.
   * @param text - Annotation text.
   * @param options - Optional type and author.
   * @returns The created annotation.
   */
  addAnnotation(timestamp: number, text: string, options?: { type?: Annotation['type']; author?: string }): Annotation {
    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      text,
      type: options?.type ?? 'note',
      author: options?.author,
      createdAt: Date.now(),
    };
    this.annotations.push(annotation);
    this.annotations.sort((a, b) => a.timestamp - b.timestamp);
    return annotation;
  }

  /** Remove an annotation by ID. Returns true if found and removed. */
  removeAnnotation(id: string): boolean {
    const idx = this.annotations.findIndex((a) => a.id === id);
    if (idx < 0) return false;
    this.annotations.splice(idx, 1);
    return true;
  }

  /** Get annotations within a time range. */
  getAnnotationsInRange(startTs: number, endTs: number): Annotation[] {
    return this.annotations.filter((a) => a.timestamp >= startTs && a.timestamp <= endTs);
  }

  /** Destroy the player and release resources. */
  dispose(): void {
    this.clearTimer();
    this.state = 'idle';
  }

  private setState(s: ReplayState): void {
    this.state = s;
    this.state$.emit(s);
  }

  private emitCurrent(): void {
    const samples = this.session.samples;
    if (this.currentIndex >= samples.length) return;
    const sample = samples[this.currentIndex]!;
    const totalMs = this.session.endTime - this.session.startTime;
    const elapsedMs = sample.timestamp - this.session.startTime;

    this.sample$.emit({
      sample,
      index: this.currentIndex,
      total: samples.length,
      speed: this.speed,
      progress: samples.length > 1 ? this.currentIndex / (samples.length - 1) : 1,
      elapsedMs,
      totalMs,
    });
  }

  private scheduleNext(): void {
    const samples = this.session.samples;
    if (this.currentIndex >= samples.length) {
      this.setState('completed');
      return;
    }

    this.emitCurrent();
    this.currentIndex++;

    if (this.currentIndex >= samples.length) {
      this.setState('completed');
      return;
    }

    // Calculate delay from inter-sample gap, adjusted by speed
    const prev = samples[this.currentIndex - 1]!;
    const next = samples[this.currentIndex]!;
    const gap = Math.max(0, next.timestamp - prev.timestamp);
    const delay = Math.max(1, gap / this.speed);

    this.timer = setTimeout(() => {
      if (this.state === 'playing') this.scheduleNext();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
