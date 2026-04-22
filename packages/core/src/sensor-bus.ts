import { SimpleStream } from './stream.js';
import type { ReadableStream } from './types.js';

/**
 * Normalized event types emitted by the multi-sensor bus. A single timeline of
 * tagged events is easier to fan out (to recorders, dashboards, MQTT, etc.)
 * than per-modality streams. Each event includes a `source` tag so consumers
 * can track multi-device sessions.
 */
export type SensorEvent =
  | { kind: 'hr'; timestamp: number; source: string; bpm: number; rrIntervals?: number[] }
  | { kind: 'power'; timestamp: number; source: string; watts: number; cadenceRpm?: number }
  | { kind: 'speed'; timestamp: number; source: string; kph: number }
  | { kind: 'cadence'; timestamp: number; source: string; rpm: number }
  | { kind: 'glucose'; timestamp: number; source: string; mgdl: number; trend?: -2 | -1 | 0 | 1 | 2 }
  | { kind: 'trainer'; timestamp: number; source: string; resistanceWatts?: number; gradePercent?: number }
  | { kind: 'spo2'; timestamp: number; source: string; percent: number }
  | { kind: 'temperature'; timestamp: number; source: string; celsius: number }
  | { kind: 'weight'; timestamp: number; source: string; kg: number; bodyFatPct?: number };

/** Discriminated `kind` literal type extracted for narrowing helpers. */
export type SensorEventKind = SensorEvent['kind'];

/** Filter helper: type-narrow `SensorEvent` to a single kind. */
export type SensorEventOf<K extends SensorEventKind> = Extract<SensorEvent, { kind: K }>;

/**
 * In-memory pub/sub for cross-modality sensor events. Ports (HR, Power,
 * Trainer, CGM, ...) push into the bus; recorders / UIs subscribe.
 *
 * The bus is *unidirectional* and *synchronous* — handlers should be cheap.
 * Use a queue or worker if you need to do expensive work per event.
 *
 * Unlike {@link SimpleStream}, the bus does NOT replay the last value to new
 * subscribers — sensor events are point-in-time facts, not state.
 */
export class SensorBus {
  private readonly listeners = new Set<(event: SensorEvent) => void>();
  private readonly stream = new SimpleStream<SensorEvent>();

  /** Push a normalized event. */
  emit(event: SensorEvent): void {
    const handlers = Array.from(this.listeners);
    for (const l of handlers) {
      try {
        l(event);
      } catch {
        // Don't let a failing listener break other listeners.
      }
    }
    this.stream.emit(event);
  }

  /** Subscribe to *all* events. Returns an unsubscribe function. */
  subscribe(handler: (event: SensorEvent) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /** Subscribe to events of a single `kind` with type-narrowed payloads. */
  on<K extends SensorEventKind>(kind: K, handler: (event: SensorEventOf<K>) => void): () => void {
    return this.subscribe((e) => {
      if (e.kind === kind) handler(e as SensorEventOf<K>);
    });
  }

  /**
   * Read-only stream view (for adapters that want a generic ReadableStream).
   * Note: replays the last event to new subscribers — useful for status
   * widgets that need to render immediately.
   */
  get events$(): ReadableStream<SensorEvent> {
    return this.stream;
  }
}
