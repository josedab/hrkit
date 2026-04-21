/**
 * Sync engine — coordinates a CrdtLog with a SyncTransport.
 *
 * Handles hello/delta handshake, write-through persistence, and
 * optional auto-pruning of old entries.
 */

import { type CrdtLog, type LogEntry, NoopSyncLogger, type SyncLogger } from './crdt-log.js';
import type { SyncStore } from './stores.js';

// ── Wire Format ─────────────────────────────────────────────────────────

/** Current wire-format version emitted by this build of `@hrkit/sync`. */
export const SYNC_WIRE_VERSION = 1 as const;

export interface SyncMessage<T = unknown> {
  type: 'hello' | 'delta';
  replicaId: string;
  v?: number;
  cursor?: { lamport: number; replicaId: string };
  cursors?: Record<string, number>;
  entries?: LogEntry<T>[];
}

export interface SyncTransport<T = unknown> {
  send(msg: SyncMessage<T>): void;
  onMessage(handler: (msg: SyncMessage<T>) => void): void;
  close(): void;
}

// ── SyncEngine ──────────────────────────────────────────────────────────

/**
 * Coordinates a {@link CrdtLog} with a {@link SyncTransport}. On open, sends
 * a `hello` containing the local cursor; on receiving a peer's `hello`,
 * replies with the deltas the peer is missing.
 */
export class SyncEngine<T = unknown> {
  private readonly store?: SyncStore<T>;
  private readonly logger: SyncLogger;
  private readonly autoPruneMax?: number;
  private saveScheduled = false;
  private saveInflight: Promise<void> = Promise.resolve();

  constructor(
    private readonly log: CrdtLog<T>,
    private readonly transport: SyncTransport<T>,
    options?: {
      store?: SyncStore<T>;
      logger?: SyncLogger;
      autoPrune?: { maxEntries: number };
    },
  ) {
    this.store = options?.store;
    this.logger = options?.logger ?? NoopSyncLogger;
    if (options?.autoPrune) {
      if (!Number.isFinite(options.autoPrune.maxEntries) || options.autoPrune.maxEntries < 1) {
        throw new RangeError('autoPrune.maxEntries must be a positive finite number');
      }
      this.autoPruneMax = options.autoPrune.maxEntries;
    }
    transport.onMessage((msg) => this.handle(msg));
  }

  /** Return per-replica contiguous high-water marks. */
  cursors(): Record<string, number> {
    return this.log.cursors();
  }

  /** Return per-replica missing lamport numbers between the high-water mark and sparse max. */
  gaps(): Record<string, number[]> {
    return this.log.gaps();
  }

  /** Load persisted state (if a store is configured) and send a `hello` to the peer. */
  async start(): Promise<void> {
    if (this.store) {
      try {
        const snap = await this.store.load();
        if (snap.length > 0) this.log.merge(snap);
      } catch (err) {
        this.logger.warn('hrkit.sync.store_load_failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.transport.send({
      type: 'hello',
      v: SYNC_WIRE_VERSION,
      replicaId: this.log.replicaId,
      cursors: this.log.cursors(),
    });
  }

  /** Append a local entry, broadcast it as a delta, and schedule persistence. */
  append(payload: T): LogEntry<T> {
    const entry = this.log.append(payload);
    this.transport.send({
      type: 'delta',
      v: SYNC_WIRE_VERSION,
      replicaId: this.log.replicaId,
      entries: [entry],
    });
    this.schedulePersist();
    return entry;
  }

  /** Wait for any in-flight persistence to complete. */
  flush(): Promise<void> {
    return this.saveInflight;
  }

  /** Close the underlying transport. */
  close(): void {
    this.transport.close();
  }

  private handle(msg: SyncMessage<T>): void {
    if (msg.type === 'hello') {
      const before = this.log.snapshot().length;
      if (msg.entries && msg.entries.length > 0) {
        this.log.merge(msg.entries);
      }
      const missing = msg.cursors ? this.log.sinceCursors(msg.cursors) : this.log.snapshot();
      if (missing.length > 0) {
        this.transport.send({
          type: 'delta',
          v: SYNC_WIRE_VERSION,
          replicaId: this.log.replicaId,
          entries: missing,
        });
      }
      if (this.log.snapshot().length !== before) this.schedulePersist();
      return;
    }
    if (msg.type === 'delta' && msg.entries && msg.entries.length > 0) {
      const before = this.log.snapshot().length;
      this.log.merge(msg.entries);
      if (this.log.snapshot().length !== before) this.schedulePersist();
    }
  }

  private schedulePersist(): void {
    if (!this.store || this.saveScheduled) return;
    this.saveScheduled = true;
    this.saveInflight = Promise.resolve().then(async () => {
      this.saveScheduled = false;
      this.maybeAutoPrune();
      try {
        await this.store!.save(this.log.snapshot());
      } catch (err) {
        this.logger.warn('hrkit.sync.store_save_failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private maybeAutoPrune(): void {
    if (this.autoPruneMax === undefined) return;
    const snap = this.log.snapshot();
    if (snap.length <= this.autoPruneMax) return;
    const cutoff = snap[snap.length - this.autoPruneMax]!.lamport;
    const { dropped } = this.log.compact(cutoff);
    if (dropped > 0) {
      this.logger.warn('hrkit.sync.auto_pruned', {
        dropped,
        kept: this.log.snapshot().length,
      });
    }
  }
}
