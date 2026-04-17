import { describe, expect, it } from 'vitest';
import { CrdtLog, MemoryStore, SyncEngine, type SyncMessage, type SyncTransport } from '../index.js';

describe('CrdtLog', () => {
  it('append assigns increasing lamport ids', () => {
    const log = new CrdtLog<string>('a');
    const e1 = log.append('hello');
    const e2 = log.append('world');
    expect(e1.lamport).toBe(1);
    expect(e2.lamport).toBe(2);
    expect(log.snapshot()).toHaveLength(2);
  });

  it('merge is idempotent and commutative', () => {
    const a = new CrdtLog<number>('a');
    const b = new CrdtLog<number>('b');
    const e1 = a.append(1);
    const e2 = b.append(2);
    a.merge([e2]);
    a.merge([e2]);
    b.merge([e1]);
    b.merge([e1]);
    expect(a.snapshot().map((e) => e.id)).toEqual(b.snapshot().map((e) => e.id));
  });

  it('since returns only newer entries', () => {
    const a = new CrdtLog<number>('a');
    a.append(1);
    a.append(2);
    a.append(3);
    expect(a.since(1)).toHaveLength(2);
    expect(a.since(2)).toHaveLength(1);
    expect(a.since(99)).toHaveLength(0);
  });

  it('fromSnapshot restores state', () => {
    const a = new CrdtLog<number>('a');
    a.append(1);
    a.append(2);
    const restored = CrdtLog.fromSnapshot<number>('a', a.snapshot());
    expect(restored.snapshot()).toEqual(a.snapshot());
    const e = restored.append(3);
    expect(e.lamport).toBe(3);
  });
});

describe('MemoryStore', () => {
  it('round-trips snapshots', async () => {
    const store = new MemoryStore<number>();
    const log = new CrdtLog<number>('a');
    log.append(1);
    log.append(2);
    await store.save(log.snapshot());
    const loaded = await store.load();
    expect(loaded).toEqual(log.snapshot());
  });
});

class PairTransport<T> implements SyncTransport<T> {
  handlers: Array<(m: SyncMessage<T>) => void> = [];
  partner?: PairTransport<T>;
  send(msg: SyncMessage<T>): void {
    if (this.partner)
      Promise.resolve().then(() => {
        for (const h of this.partner!.handlers) h(msg);
      });
  }
  onMessage(handler: (m: SyncMessage<T>) => void): void {
    this.handlers.push(handler);
  }
  close(): void {}
}

function pair<T>() {
  const a = new PairTransport<T>();
  const b = new PairTransport<T>();
  a.partner = b;
  b.partner = a;
  return { a, b };
}

describe('SyncEngine', () => {
  it('exchanges deltas via paired transports', async () => {
    const logA = new CrdtLog<number>('a');
    const logB = new CrdtLog<number>('b');
    logA.append(1);
    logA.append(2);
    logB.append(99);
    const { a, b } = pair<number>();
    const eA = new SyncEngine(logA, a);
    const eB = new SyncEngine(logB, b);
    eA.start();
    eB.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(logA.snapshot().length).toBe(3);
    expect(logB.snapshot().length).toBe(3);
  });

  it('broadcasts subsequent local appends', async () => {
    const logA = new CrdtLog<string>('a');
    const logB = new CrdtLog<string>('b');
    const { a, b } = pair<string>();
    const eA = new SyncEngine(logA, a);
    new SyncEngine(logB, b);
    eA.start();
    await new Promise((r) => setTimeout(r, 5));
    eA.append('live');
    await new Promise((r) => setTimeout(r, 5));
    expect(logB.snapshot().some((e) => e.payload === 'live')).toBe(true);
  });
});
