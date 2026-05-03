import { getLogger } from './logger.js';
import { SimpleStream } from './stream.js';
import type { ReadableStream } from './types.js';

/**
 * Normalized event types emitted by the multi-sensor bus.
 *
 * A single timeline of tagged, discriminated-union events is easier to fan out
 * (to recorders, dashboards, MQTT, etc.) than per-modality streams. Each event
 * carries a `kind` discriminant for type narrowing, a monotonic `timestamp`,
 * and a `source` tag so consumers can track multi-device sessions.
 *
 * @example
 * ```ts
 * // Type narrowing via discriminant
 * bus.on('hr', (e) => {
 *   console.log(e.bpm, e.rrIntervals); // fully typed
 * });
 * ```
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
 * In-memory pub/sub for cross-modality sensor events.
 *
 * Ports (HR, Power, Trainer, CGM, …) push into the bus; recorders and UIs
 * subscribe. The bus is *unidirectional* and *synchronous* — handlers should
 * be cheap. Use a queue or worker if you need to do expensive work per event.
 *
 * Unlike {@link SimpleStream}, the bus does NOT replay the last value to new
 * subscribers — sensor events are point-in-time facts, not state.
 *
 * @example
 * ```ts
 * const bus = new SensorBus();
 *
 * // Subscribe to all events
 * const unsub = bus.subscribe((e) => console.log(e.kind, e.source));
 *
 * // Subscribe to a single modality with type narrowing
 * bus.on('hr', (e) => console.log(`HR: ${e.bpm} bpm`));
 * bus.on('power', (e) => console.log(`Power: ${e.watts} W`));
 *
 * // Emit events from an adapter
 * bus.emit({ kind: 'hr', timestamp: Date.now(), source: 'polar-h10', bpm: 142 });
 *
 * // Clean up
 * unsub();
 * ```
 */
export class SensorBus {
  private readonly listeners = new Set<(event: SensorEvent) => void>();
  private readonly stream = new SimpleStream<SensorEvent>();

  /**
   * Push a normalized event to all subscribers.
   *
   * Handlers are invoked synchronously in registration order. A throwing
   * handler is silently caught so it cannot break other listeners.
   *
   * @param event - The sensor event to broadcast.
   */
  emit(event: SensorEvent): void {
    const handlers = Array.from(this.listeners);
    for (const l of handlers) {
      try {
        l(event);
      } catch (err) {
        getLogger().warn('SensorBus listener threw', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    this.stream.emit(event);
  }

  /**
   * Subscribe to *all* events regardless of kind.
   *
   * @param handler - Callback invoked for every emitted event.
   * @returns An unsubscribe function. Call it to remove the handler.
   */
  subscribe(handler: (event: SensorEvent) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Subscribe to events of a single `kind` with type-narrowed payloads.
   *
   * @param kind - The event kind to listen for (e.g. `'hr'`, `'power'`).
   * @param handler - Callback invoked only for events matching `kind`.
   * @returns An unsubscribe function.
   */
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
