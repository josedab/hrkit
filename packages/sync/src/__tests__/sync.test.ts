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

  it('rejects circular references with ValidationError', () => {
    const log = new CrdtLog<unknown>('a');
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj; // circular reference
    expect(() => log.append(obj)).toThrow(/not JSON-serializable/);
  });

  it('rejects payloads exceeding maxPayloadBytes', () => {
    const log = new CrdtLog<string>('a', { maxPayloadBytes: 10 });
    expect(() => log.append('this is a very long string that exceeds the limit')).toThrow(/too large/);
  });

  it('accepts payloads within maxPayloadBytes', () => {
    const log = new CrdtLog<string>('a', { maxPayloadBytes: 100 });
    expect(() => log.append('short')).not.toThrow();
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

  it('hydrates from store on start and persists local appends', async () => {
    const store = new MemoryStore<string>();
    // Pre-populate the store as if a previous session had written to it.
    const seed = new CrdtLog<string>('a');
    seed.append('persisted');
    await store.save(seed.snapshot());

    const log = new CrdtLog<string>('a');
    const { a } = pair<string>();
    const engine = new SyncEngine(log, a, { store });
    await engine.start();
    expect(log.snapshot().map((e) => e.payload)).toEqual(['persisted']);

    engine.append('fresh');
    await engine.flush();
    const reloaded = await store.load();
    expect(reloaded.map((e) => e.payload)).toEqual(['persisted', 'fresh']);
  });

  it('coalesces multiple appends into a single store.save', async () => {
    let saves = 0;
    const store: import('../index.js').SyncStore<number> = {
      load: async () => [],
      save: async () => {
        saves++;
      },
    };
    const log = new CrdtLog<number>('a');
    const { a } = pair<number>();
    const engine = new SyncEngine(log, a, { store });
    engine.append(1);
    engine.append(2);
    engine.append(3);
    await engine.flush();
    expect(saves).toBe(1);
  });

  it('store load failure does not crash start', async () => {
    const warnings: string[] = [];
    const store: import('../index.js').SyncStore<number> = {
      load: async () => {
        throw new Error('disk full');
      },
      save: async () => undefined,
    };
    const log = new CrdtLog<number>('a');
    const { a } = pair<number>();
    const engine = new SyncEngine(log, a, {
      store,
      logger: { warn: (msg) => warnings.push(msg) },
    });
    await engine.start();
    expect(warnings).toContain('hrkit.sync.store_load_failed');
  });
});

describe('WebSocketSyncTransport', () => {
  function fakeSocket(state: number) {
    const listeners: Record<string, Array<(ev: { data?: unknown }) => void>> = {};
    let sent = 0;
    return {
      readyState: state,
      OPEN: 1,
      CONNECTING: 0,
      CLOSING: 2,
      CLOSED: 3,
      send: () => {
        sent++;
      },
      addEventListener: (type: string, h: (ev: { data?: unknown }) => void) => {
        const arr = listeners[type] ?? [];
        arr.push(h);
        listeners[type] = arr;
      },
      close: () => undefined,
      sentCount: () => sent,
    };
  }

  it('warns and drops when socket is CLOSED', async () => {
    const { WebSocketSyncTransport } = await import('../index.js');
    const sock = fakeSocket(3);
    const warnings: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
    const t = new WebSocketSyncTransport<number>(sock as unknown as WebSocket, {
      logger: { warn: (msg, meta) => warnings.push({ msg, meta }) },
    });
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    expect(sock.sentCount()).toBe(0);
    expect(warnings[0]?.msg).toBe('hrkit.sync.send_dropped');
    expect(warnings[0]?.meta?.reason).toBe('closed');
  });

  it('sends immediately when socket is OPEN', async () => {
    const { WebSocketSyncTransport } = await import('../index.js');
    const sock = fakeSocket(1);
    const t = new WebSocketSyncTransport<number>(sock as unknown as WebSocket);
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    expect(sock.sentCount()).toBe(1);
  });
});

describe('CrdtLog.compact', () => {
  it('drops entries below the cutoff and preserves the clock', () => {
    const log = new CrdtLog<number>('a');
    log.append(1);
    log.append(2);
    log.append(3);
    const { dropped } = log.compact(3);
    expect(dropped).toBe(2);
    expect(log.snapshot().map((e) => e.payload)).toEqual([3]);
    const next = log.append(4);
    expect(next.lamport).toBe(4);
  });

  it('rejects non-finite cutoff', () => {
    const log = new CrdtLog<number>('a');
    expect(() => log.compact(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('ReconnectingWebSocketSyncTransport', () => {
  // Minimal in-memory WebSocket double we can drive deterministically.
  class FakeWS {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;
    OPEN = 1;
    CONNECTING = 0;
    CLOSING = 2;
    CLOSED = 3;
    readyState = 0;
    sent: string[] = [];
    listeners: Record<string, Array<(ev: { data?: unknown }) => void>> = {};
    addEventListener(type: string, h: (ev: { data?: unknown }) => void) {
      const arr = this.listeners[type] ?? [];
      arr.push(h);
      this.listeners[type] = arr;
    }
    send(s: string) {
      this.sent.push(s);
    }
    close() {
      this.readyState = this.CLOSED;
      for (const h of this.listeners.close ?? []) h({});
    }
    fireOpen() {
      this.readyState = this.OPEN;
      for (const h of this.listeners.open ?? []) h({});
    }
    fireMessage(data: string) {
      for (const h of this.listeners.message ?? []) h({ data });
    }
  }

  it('buffers messages while disconnected and flushes on open', async () => {
    const sockets: FakeWS[] = [];
    const { ReconnectingWebSocketSyncTransport } = await import('../index.js');
    const t = new ReconnectingWebSocketSyncTransport<number>(
      () => {
        const s = new FakeWS();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
      { initialDelayMs: 1, maxDelayMs: 1, jitter: 0 },
    );
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    expect(t.bufferedMessageCount).toBe(2);
    sockets[0]!.fireOpen();
    expect(sockets[0]!.sent).toHaveLength(2);
    expect(t.bufferedMessageCount).toBe(0);
    t.close();
  });

  it('reconnects on close and resets attempt counter on open', async () => {
    const sockets: FakeWS[] = [];
    const warns: string[] = [];
    const { ReconnectingWebSocketSyncTransport } = await import('../index.js');
    const t = new ReconnectingWebSocketSyncTransport<number>(
      () => {
        const s = new FakeWS();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
      { initialDelayMs: 1, maxDelayMs: 1, jitter: 0, logger: { warn: (m) => warns.push(m) } },
    );
    sockets[0]!.fireOpen();
    expect(t.connected).toBe(true);
    sockets[0]!.close();
    await new Promise((r) => setTimeout(r, 10));
    expect(sockets.length).toBe(2);
    expect(t.reconnectAttempts).toBe(1);
    sockets[1]!.fireOpen();
    expect(t.reconnectAttempts).toBe(0);
    expect(warns).toContain('hrkit.sync.reconnect_scheduled');
    t.close();
  });

  it('drops messages once buffer is full', async () => {
    const sockets: FakeWS[] = [];
    const warns: Array<{ msg: string; meta?: Record<string, unknown> }> = [];
    const { ReconnectingWebSocketSyncTransport } = await import('../index.js');
    const t = new ReconnectingWebSocketSyncTransport<number>(
      () => {
        const s = new FakeWS();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
      {
        initialDelayMs: 1,
        maxDelayMs: 1,
        jitter: 0,
        maxBufferedMessages: 2,
        logger: { warn: (msg, meta) => warns.push({ msg, meta }) },
      },
    );
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    t.send({ type: 'delta', replicaId: 'a', entries: [] });
    expect(t.bufferedMessageCount).toBe(2);
    expect(warns.find((w) => w.msg === 'hrkit.sync.send_dropped')?.meta?.reason).toBe('buffer_full');
    t.close();
  });

  it('stops after maxAttempts', async () => {
    const sockets: FakeWS[] = [];
    const warns: string[] = [];
    const { ReconnectingWebSocketSyncTransport } = await import('../index.js');
    const t = new ReconnectingWebSocketSyncTransport<number>(
      () => {
        const s = new FakeWS();
        sockets.push(s);
        return s as unknown as WebSocket;
      },
      { initialDelayMs: 1, maxDelayMs: 1, jitter: 0, maxAttempts: 2, logger: { warn: (m) => warns.push(m) } },
    );
    sockets[0]!.close();
    await new Promise((r) => setTimeout(r, 10));
    sockets[1]!.close();
    await new Promise((r) => setTimeout(r, 10));
    sockets[2]!.close();
    await new Promise((r) => setTimeout(r, 10));
    expect(warns).toContain('hrkit.sync.reconnect_giveup');
    t.close();
  });
});

describe('CrdtLog cursors', () => {
  it('cursors() returns per-replica high-water marks', () => {
    const a = new CrdtLog<number>('a');
    const b = new CrdtLog<number>('b');
    a.append(1);
    a.append(2);
    b.append(99);
    a.merge(b.snapshot());
    expect(a.cursors()).toEqual({ a: 2, b: 1 });
  });

  it('cursors() stops at first gap (contiguous, not sparse)', () => {
    const a = new CrdtLog<number>('a');
    // Receive lamports 1, 2, then skip 3, then 4, 5 from peer b.
    a.merge([
      { id: 'b:1', replicaId: 'b', lamport: 1, payload: 1 },
      { id: 'b:2', replicaId: 'b', lamport: 2, payload: 2 },
      { id: 'b:4', replicaId: 'b', lamport: 4, payload: 4 },
      { id: 'b:5', replicaId: 'b', lamport: 5, payload: 5 },
    ]);
    // Sparse max would be 5; contiguous max stops at 2 because lamport 3 is missing.
    expect(a.cursors()).toEqual({ b: 2 });
  });

  it('gaps() lists missing lamports between contiguous and sparse max', () => {
    const a = new CrdtLog<number>('a');
    expect(a.gaps()).toEqual({});
    a.merge([
      { id: 'b:1', replicaId: 'b', lamport: 1, payload: 1 },
      { id: 'b:4', replicaId: 'b', lamport: 4, payload: 4 },
      { id: 'b:6', replicaId: 'b', lamport: 6, payload: 6 },
      { id: 'c:2', replicaId: 'c', lamport: 2, payload: 2 },
    ]);
    expect(a.gaps()).toEqual({ b: [2, 3, 5], c: [1] });
    // Once the gap is filled, that replica drops out of gaps().
    a.merge([
      { id: 'b:2', replicaId: 'b', lamport: 2, payload: 2 },
      { id: 'b:3', replicaId: 'b', lamport: 3, payload: 3 },
      { id: 'b:5', replicaId: 'b', lamport: 5, payload: 5 },
    ]);
    expect(a.gaps()).toEqual({ c: [1] });
  });

  it('sinceCursors omits entries the peer already has', () => {
    const a = new CrdtLog<string>('a');
    a.append('x');
    a.append('y');
    a.merge([
      { id: 'b:1', replicaId: 'b', lamport: 1, payload: 'B-old' },
      { id: 'b:2', replicaId: 'b', lamport: 2, payload: 'B-new' },
    ]);
    // Peer already has all of 'a' up to 2 and 'b' up to 1.
    const missing = a.sinceCursors({ a: 2, b: 1 });
    expect(missing.map((e) => e.id)).toEqual(['b:2']);
  });

  it('sinceCursors treats unknown replicas as cursor=0', () => {
    const a = new CrdtLog<number>('a');
    a.append(1);
    expect(a.sinceCursors({}).map((e) => e.id)).toEqual(['a:1']);
  });
});

describe('SyncEngine cursor handshake', () => {
  // Use the existing pair() helper from the SyncEngine block above.
  it('hello carries cursors and reply omits already-known entries', async () => {
    const logA = new CrdtLog<string>('a');
    const logB = new CrdtLog<string>('b');
    logA.append('a1');
    logA.append('a2');
    logB.append('b1');
    // B already has a1.
    logB.merge([logA.snapshot()[0]!]);

    const sentByB: SyncMessage<string>[] = [];
    const a: SyncTransport<string> = {
      send: () => undefined,
      onMessage: () => undefined,
      close: () => undefined,
    };
    const b: SyncTransport<string> = {
      send: (m) => sentByB.push(m),
      onMessage: () => undefined,
      close: () => undefined,
    };
    let bHandle: ((m: SyncMessage<string>) => void) | undefined;
    b.onMessage = (h) => {
      bHandle = h;
    };
    new SyncEngine(logA, a);
    new SyncEngine(logB, b);
    // Simulate A's hello arriving at B.
    bHandle!({ type: 'hello', replicaId: 'a', cursors: logA.cursors() });
    const delta = sentByB.find((m) => m.type === 'delta');
    expect(delta).toBeDefined();
    // B should send only b1 — A already has a1/a2.
    expect(delta!.entries!.map((e) => e.id)).toEqual(['b:1']);
  });

  it('legacy hello (no cursors) still gets full snapshot reply', () => {
    const log = new CrdtLog<number>('a');
    log.append(1);
    log.append(2);
    const sent: SyncMessage<number>[] = [];
    let handle: ((m: SyncMessage<number>) => void) | undefined;
    const t: SyncTransport<number> = {
      send: (m) => sent.push(m),
      onMessage: (h) => {
        handle = h;
      },
      close: () => undefined,
    };
    new SyncEngine(log, t);
    handle!({ type: 'hello', replicaId: 'b' /* no cursors */ });
    const delta = sent.find((m) => m.type === 'delta');
    expect(delta!.entries).toHaveLength(2);
  });

  it('round-trip: two engines converge with cursor handshake', async () => {
    const logA = new CrdtLog<number>('a');
    const logB = new CrdtLog<number>('b');
    logA.append(1);
    logA.append(2);
    logB.append(99);
    const { a, b } = pair<number>();
    new SyncEngine(logA, a).start();
    new SyncEngine(logB, b).start();
    await new Promise((r) => setTimeout(r, 10));
    expect(logA.snapshot().length).toBe(3);
    expect(logB.snapshot().length).toBe(3);
  });
});

describe('SyncEngine restart-from-store', () => {
  it('a fresh engine resumes from the persisted snapshot', async () => {
    const store = new MemoryStore<string>();
    // Session 1: append three entries, persist.
    {
      const log = new CrdtLog<string>('a');
      const { a } = pair<string>();
      const engine = new SyncEngine(log, a, { store });
      engine.append('s1-1');
      engine.append('s1-2');
      engine.append('s1-3');
      await engine.flush();
    }
    // Session 2: cold-start a new engine from the same store.
    const log2 = new CrdtLog<string>('a');
    const { a: a2 } = pair<string>();
    const engine2 = new SyncEngine(log2, a2, { store });
    await engine2.start();
    expect(log2.snapshot().map((e) => e.payload)).toEqual(['s1-1', 's1-2', 's1-3']);
    // Lamport clock must continue past the persisted high-water mark.
    const next = engine2.append('s2-1');
    expect(next.lamport).toBe(4);
    await engine2.flush();
    const onDisk = await store.load();
    expect(onDisk.map((e) => e.payload)).toEqual(['s1-1', 's1-2', 's1-3', 's2-1']);
  });
});

describe('SyncEngine.cursors getter', () => {
  it('reflects the underlying log cursors', () => {
    const log = new CrdtLog<number>('a');
    log.append(1);
    log.append(2);
    const t: SyncTransport<number> = {
      send: () => undefined,
      onMessage: () => undefined,
      close: () => undefined,
    };
    const engine = new SyncEngine(log, t);
    expect(engine.cursors()).toEqual({ a: 2 });
  });

  it('gaps() proxies CrdtLog.gaps()', () => {
    const log = new CrdtLog<number>('a');
    log.merge([
      { id: 'b:1', replicaId: 'b', lamport: 1, payload: 1 },
      { id: 'b:3', replicaId: 'b', lamport: 3, payload: 3 },
    ]);
    const t: SyncTransport<number> = {
      send: () => undefined,
      onMessage: () => undefined,
      close: () => undefined,
    };
    const engine = new SyncEngine(log, t);
    expect(engine.gaps()).toEqual({ b: [2] });
  });
});

describe('SyncEngine autoPrune', () => {
  it('drops oldest entries past the cap after each persist', async () => {
    const store = new MemoryStore<number>();
    const log = new CrdtLog<number>('a');
    const t: SyncTransport<number> = {
      send: () => undefined,
      onMessage: () => undefined,
      close: () => undefined,
    };
    const warns: string[] = [];
    const engine = new SyncEngine(log, t, {
      store,
      logger: { warn: (m) => warns.push(m) },
      autoPrune: { maxEntries: 3 },
    });
    engine.append(1);
    engine.append(2);
    engine.append(3);
    engine.append(4);
    engine.append(5);
    await engine.flush();
    expect(log.snapshot().map((e) => e.payload)).toEqual([3, 4, 5]);
    expect(warns).toContain('hrkit.sync.auto_pruned');
    // Persisted snapshot already reflects the pruned state — prune runs
    // before save in each persist cycle.
    expect((await store.load()).map((e) => e.payload)).toEqual([3, 4, 5]);
    engine.append(6);
    await engine.flush();
    expect((await store.load()).map((e) => e.payload)).toEqual([4, 5, 6]);
  });

  it('rejects invalid maxEntries', () => {
    const log = new CrdtLog<number>('a');
    const t: SyncTransport<number> = {
      send: () => undefined,
      onMessage: () => undefined,
      close: () => undefined,
    };
    expect(() => new SyncEngine(log, t, { autoPrune: { maxEntries: 0 } })).toThrow(RangeError);
    expect(() => new SyncEngine(log, t, { autoPrune: { maxEntries: Number.NaN } })).toThrow(RangeError);
  });
});

describe('Wire format version stamp', () => {
  it('SYNC_WIRE_VERSION is exported and current = 1', async () => {
    const { SYNC_WIRE_VERSION } = await import('../index.js');
    expect(SYNC_WIRE_VERSION).toBe(1);
  });

  it('every outbound message carries v', () => {
    const sent: SyncMessage<number>[] = [];
    let handle: ((m: SyncMessage<number>) => void) | undefined;
    const t: SyncTransport<number> = {
      send: (m) => sent.push(m),
      onMessage: (h) => {
        handle = h;
      },
      close: () => undefined,
    };
    const log = new CrdtLog<number>('a');
    const engine = new SyncEngine(log, t);
    engine.start();
    engine.append(1);
    handle!({ type: 'hello', replicaId: 'b', cursors: {} });
    expect(sent).toHaveLength(3); // hello + delta(1) + delta-reply
    expect(sent.every((m) => m.v === 1)).toBe(true);
  });
});

describe('createMockTransportPair', () => {
  it('delivers messages bidirectionally between paired engines', async () => {
    const { createMockTransportPair } = await import('../index.js');
    const [tA, tB] = createMockTransportPair<number>();
    const logA = new CrdtLog<number>('a');
    const logB = new CrdtLog<number>('b');
    const eA = new SyncEngine(logA, tA);
    const eB = new SyncEngine(logB, tB);
    await eA.start();
    await eB.start();
    eA.append(1);
    eA.append(2);
    eB.append(3);
    expect(
      logA
        .snapshot()
        .map((e) => e.payload)
        .sort(),
    ).toEqual([1, 2, 3]);
    expect(
      logB
        .snapshot()
        .map((e) => e.payload)
        .sort(),
    ).toEqual([1, 2, 3]);
  });

  it('honours dropRate', async () => {
    const { createMockTransportPair } = await import('../index.js');
    let calls = 0;
    const [tA] = createMockTransportPair<number>({
      dropRate: 1, // drop everything
      random: () => {
        calls++;
        return 0; // always < 1, so always drops
      },
    });
    let received = 0;
    tA.onMessage(() => received++);
    tA.send({ type: 'hello', replicaId: 'x' });
    expect(calls).toBe(1);
    expect(received).toBe(0);
  });

  it('eventually converges with random drops via repeated handshake', async () => {
    const { createMockTransportPair } = await import('../index.js');
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const [tA, tB] = createMockTransportPair<number>({ dropRate: 0.5, random: rand });
    const logA = new CrdtLog<number>('a');
    const logB = new CrdtLog<number>('b');
    const eA = new SyncEngine(logA, tA);
    const eB = new SyncEngine(logB, tB);
    await eA.start();
    await eB.start();
    for (let i = 0; i < 20; i++) {
      eA.append(i);
      eB.append(100 + i);
    }
    // Repeated handshakes recover gaps because cursors() reports the
    // contiguous high-water mark — peers re-send entries above any gap
    // until the receiver fills it in. merge() is idempotent.
    for (let attempt = 0; attempt < 200; attempt++) {
      if (logA.snapshot().length === 40 && logB.snapshot().length === 40) break;
      await eA.start();
      await eB.start();
    }
    expect(logA.snapshot().length).toBe(40);
    expect(logB.snapshot().length).toBe(40);
    const valuesA = logA
      .snapshot()
      .map((e) => e.payload)
      .sort((x, y) => x - y);
    const valuesB = logB
      .snapshot()
      .map((e) => e.payload)
      .sort((x, y) => x - y);
    expect(valuesA).toEqual(valuesB);
  });
});
