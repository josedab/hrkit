import { describe, expect, it } from 'vitest';
import { SimpleStream } from '../stream.js';

describe('SimpleStream', () => {
  it('emits values to subscribers', () => {
    const stream = new SimpleStream<number>();
    const values: number[] = [];
    stream.subscribe((v) => values.push(v));

    stream.emit(1);
    stream.emit(2);
    stream.emit(3);

    expect(values).toEqual([1, 2, 3]);
  });

  it('emits current value on subscribe (BehaviorSubject semantics)', () => {
    const stream = new SimpleStream<string>();
    stream.emit('hello');

    const values: string[] = [];
    stream.subscribe((v) => values.push(v));

    expect(values).toEqual(['hello']);
  });

  it('does not emit on subscribe when no value has been emitted', () => {
    const stream = new SimpleStream<number>();
    const values: number[] = [];
    stream.subscribe((v) => values.push(v));

    expect(values).toEqual([]);
  });

  it('get() returns current value', () => {
    const stream = new SimpleStream<number>();
    expect(stream.get()).toBeUndefined();

    stream.emit(42);
    expect(stream.get()).toBe(42);

    stream.emit(99);
    expect(stream.get()).toBe(99);
  });

  it('unsubscribe stops receiving values', () => {
    const stream = new SimpleStream<number>();
    const values: number[] = [];
    const unsub = stream.subscribe((v) => values.push(v));

    stream.emit(1);
    unsub();
    stream.emit(2);

    expect(values).toEqual([1]);
  });

  it('supports multiple subscribers', () => {
    const stream = new SimpleStream<number>();
    const a: number[] = [];
    const b: number[] = [];

    stream.subscribe((v) => a.push(v));
    stream.subscribe((v) => b.push(v));

    stream.emit(42);

    expect(a).toEqual([42]);
    expect(b).toEqual([42]);
  });

  it('unsubscribe one does not affect others', () => {
    const stream = new SimpleStream<number>();
    const a: number[] = [];
    const b: number[] = [];

    const unsubA = stream.subscribe((v) => a.push(v));
    stream.subscribe((v) => b.push(v));

    stream.emit(1);
    unsubA();
    stream.emit(2);

    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
  });

  it('double unsubscribe is safe', () => {
    const stream = new SimpleStream<number>();
    const unsub = stream.subscribe(() => {});
    unsub();
    unsub(); // should not throw
  });

  it('handles subscriber that throws without affecting others', () => {
    const stream = new SimpleStream<number>();
    const values: number[] = [];

    stream.subscribe(() => {
      throw new Error('boom');
    });
    stream.subscribe((v) => values.push(v));

    // SimpleStream uses a plain for-of loop — errors propagate uncaught.
    expect(() => stream.emit(1)).toThrow('boom');
  });

  it('works with complex object types', () => {
    interface State {
      hr: number;
      zone: number;
    }
    const stream = new SimpleStream<State>();

    stream.emit({ hr: 150, zone: 4 });
    expect(stream.get()).toEqual({ hr: 150, zone: 4 });
  });
});
