/**
 * Local-first append-only CRDT sync for `@hrkit`.
 *
 * Heart-rate sample streams are *grow-only* — samples never change after
 * they're recorded — which means a full Yjs/Automerge engine is overkill.
 * Instead we ship a tiny Lamport-clock log that two replicas can merge
 * deterministically. Each entry carries a (replicaId, lamport) pair; ties
 * break on replicaId so merge is commutative, associative, and idempotent.
 *
 * Storage providers are pluggable; we ship a {@link MemoryStore} for tests
 * and an {@link IndexedDBStore} factory for browsers. Sync transports are
 * also pluggable; {@link WebSocketSync} streams entries between two replicas.
 */

export interface LogEntry<T = unknown> {
  /** Globally unique entry id (`replicaId:lamport`). */
  id: string;
  replicaId: string;
  lamport: number;
  payload: T;
}

export class CrdtLog<T = unknown> {
  readonly replicaId: string;
  private clock = 0;
  private readonly entries = new Map<string, LogEntry<T>>();

  constructor(replicaId: string) {
    if (!replicaId) throw new Error('replicaId is required');
    this.replicaId = replicaId;
  }

  /** Insert a local payload. Bumps the Lamport clock. */
  append(payload: T): LogEntry<T> {
    this.clock += 1;
    const entry: LogEntry<T> = {
      id: `${this.replicaId}:${this.clock}`,
      replicaId: this.replicaId,
      lamport: this.clock,
      payload,
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Merge a batch of remote entries. Idempotent. */
  merge(remote: LogEntry<T>[]): { added: number } {
    let added = 0;
    for (const e of remote) {
      if (!this.entries.has(e.id)) {
        this.entries.set(e.id, e);
        added++;
        if (e.lamport > this.clock) this.clock = e.lamport;
      }
    }
    return { added };
  }

  /** Sorted snapshot suitable for replay. */
  snapshot(): LogEntry<T>[] {
    return Array.from(this.entries.values()).sort((a, b) => {
      if (a.lamport !== b.lamport) return a.lamport - b.lamport;
      return a.replicaId < b.replicaId ? -1 : 1;
    });
  }

  /** Entries strictly after the supplied (lamport, replicaId) tuple — for delta sync. */
  since(lamport: number, replicaId?: string): LogEntry<T>[] {
    return this.snapshot().filter((e) => {
      if (e.lamport > lamport) return true;
      if (e.lamport < lamport) return false;
      return replicaId !== undefined && e.replicaId > replicaId;
    });
  }

  /** Restore from a previously persisted snapshot. */
  static fromSnapshot<T>(replicaId: string, snapshot: LogEntry<T>[]): CrdtLog<T> {
    const log = new CrdtLog<T>(replicaId);
    log.merge(snapshot);
    return log;
  }
}

// ── Storage providers ───────────────────────────────────────────────────

export interface SyncStore<T = unknown> {
  load(): Promise<LogEntry<T>[]>;
  save(snapshot: LogEntry<T>[]): Promise<void>;
}

export class MemoryStore<T = unknown> implements SyncStore<T> {
  private snapshot: LogEntry<T>[] = [];
  async load(): Promise<LogEntry<T>[]> {
    return this.snapshot.slice();
  }
  async save(snapshot: LogEntry<T>[]): Promise<void> {
    this.snapshot = snapshot.slice();
  }
}

/**
 * IndexedDB-backed store factory. Returns a {@link SyncStore} bound to a
 * specific DB + object-store name. Caller must run inside a browser; throws
 * synchronously if `indexedDB` isn't available.
 */
export function createIndexedDBStore<T = unknown>(dbName: string, storeName = 'hrkit-sync'): SyncStore<T> {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) throw new Error('IndexedDB is not available in this runtime');

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = idb!.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async load() {
      const db = await open();
      return await new Promise<LogEntry<T>[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get('snapshot');
        req.onsuccess = () => resolve((req.result as LogEntry<T>[] | undefined) ?? []);
        req.onerror = () => reject(req.error);
      });
    },
    async save(snapshot) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(snapshot, 'snapshot');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

// ── Wire format & transports ────────────────────────────────────────────

export interface SyncMessage<T = unknown> {
  type: 'hello' | 'delta';
  replicaId: string;
  /** Highest lamport the sender has seen — peer should reply with deltas after it. */
  cursor?: { lamport: number; replicaId: string };
  entries?: LogEntry<T>[];
}

export interface SyncTransport<T = unknown> {
  send(msg: SyncMessage<T>): void;
  onMessage(handler: (msg: SyncMessage<T>) => void): void;
  close(): void;
}

/**
 * Coordinates a {@link CrdtLog} with a {@link SyncTransport}. On open, sends
 * a `hello` containing the local cursor; on receiving a peer's `hello`,
 * replies with the deltas the peer is missing.
 */
export class SyncEngine<T = unknown> {
  constructor(
    private readonly log: CrdtLog<T>,
    private readonly transport: SyncTransport<T>,
  ) {
    transport.onMessage((msg) => this.handle(msg));
  }

  start(): void {
    // First-contact handshake: announce ourselves and ship our entire snapshot.
    // Merge is idempotent so this is safe; for very large logs callers can
    // implement a per-replica cursor map and use {@link CrdtLog.since} instead.
    const snap = this.log.snapshot();
    this.transport.send({
      type: 'hello',
      replicaId: this.log.replicaId,
      entries: snap,
    });
  }

  /** Append locally and broadcast the entry. */
  append(payload: T): LogEntry<T> {
    const entry = this.log.append(payload);
    this.transport.send({
      type: 'delta',
      replicaId: this.log.replicaId,
      entries: [entry],
    });
    return entry;
  }

  private handle(msg: SyncMessage<T>): void {
    if (msg.type === 'hello') {
      if (msg.entries && msg.entries.length > 0) {
        this.log.merge(msg.entries);
      }
      // Reply with our own snapshot so the peer catches up too.
      const snap = this.log.snapshot();
      if (snap.length > 0) {
        this.transport.send({ type: 'delta', replicaId: this.log.replicaId, entries: snap });
      }
      return;
    }
    if (msg.type === 'delta' && msg.entries) {
      this.log.merge(msg.entries);
    }
  }

  close(): void {
    this.transport.close();
  }
}

/** WebSocket transport. Frames are JSON-serialized {@link SyncMessage}s. */
export class WebSocketSyncTransport<T = unknown> implements SyncTransport<T> {
  private handlers: Array<(msg: SyncMessage<T>) => void> = [];

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (ev) => {
      try {
        const data = typeof ev.data === 'string' ? ev.data : '';
        const msg = JSON.parse(data) as SyncMessage<T>;
        for (const h of this.handlers) h(msg);
      } catch {
        /* ignore malformed */
      }
    });
  }

  send(msg: SyncMessage<T>): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      this.socket.addEventListener('open', () => this.socket.send(JSON.stringify(msg)), { once: true });
    }
  }

  onMessage(handler: (msg: SyncMessage<T>) => void): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.socket.close();
  }
}
