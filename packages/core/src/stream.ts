import type { ReadableStream, Unsubscribe } from './types.js';

/**
 * Minimal observable stream with BehaviorSubject-like semantics.
 * Emits the current value to new subscribers immediately on subscribe.
 *
 * Used internally across @hrkit/core modules (SessionRecorder, WorkoutEngine,
 * MultiDeviceManager, GroupSession, windowed metrics) to provide a consistent
 * zero-dependency observable pattern.
 */
export class SimpleStream<T> implements ReadableStream<T> {
  private listeners = new Set<(value: T) => void>();
  private current: T | undefined;

  /**
   * @param listener - Callback invoked with each emitted value.
   * @returns Unsubscribe function.
   */
  subscribe(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener);
    if (this.current !== undefined) {
      listener(this.current);
    }
    return () => this.listeners.delete(listener);
  }

  get(): T | undefined {
    return this.current;
  }

  /**
   * Emit a value to all subscribers and update the current value.
   *
   * @param value - Value to emit to all subscribers.
   */
  emit(value: T): void {
    this.current = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}
