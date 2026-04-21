/**
 * Lamport-clock append-only CRDT log.
 *
 * Grow-only log where each entry carries a `(replicaId, lamport)` pair.
 * Ties break on replicaId so merge is commutative, associative, and idempotent.
 */

import { ValidationError } from '@hrkit/core';

// ── Types ───────────────────────────────────────────────────────────────

/** Minimal sink for transport-level diagnostics. Compatible with `@hrkit/core`'s `Logger`. */
export interface SyncLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
}

export const NoopSyncLogger: SyncLogger = { warn: () => undefined };

export interface LogEntry<T = unknown> {
  /** Globally unique entry id (`replicaId:lamport`). */
  id: string;
  replicaId: string;
  lamport: number;
  payload: T;
}

// ── CrdtLog ─────────────────────────────────────────────────────────────

/**
 * Lamport-clock append-only CRDT log. Entries merge commutatively — safe for
 * concurrent multi-device sync without coordination.
 */
export class CrdtLog<T = unknown> {
  readonly replicaId: string;
  private clock = 0;
  private readonly entries = new Map<string, LogEntry<T>>();

  constructor(replicaId: string) {
    if (!replicaId) throw new ValidationError('replicaId is required');
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

  /**
   * Per-replica contiguous high-water mark: `{ replicaId: maxN }` where
   * every lamport in `1..maxN` from that replica is present locally.
   */
  cursors(): Record<string, number> {
    const seen = new Map<string, Set<number>>();
    for (const e of this.entries.values()) {
      let bucket = seen.get(e.replicaId);
      if (!bucket) {
        bucket = new Set<number>();
        seen.set(e.replicaId, bucket);
      }
      bucket.add(e.lamport);
    }
    const out: Record<string, number> = {};
    for (const [rid, lamports] of seen) {
      let n = 0;
      while (lamports.has(n + 1)) n++;
      out[rid] = n;
    }
    return out;
  }

  /** Entries the peer (described by `peerCursors`) is missing. */
  sinceCursors(peerCursors: Record<string, number>): LogEntry<T>[] {
    return this.snapshot().filter((e) => e.lamport > (peerCursors[e.replicaId] ?? 0));
  }

  /** Per-replica missing lamports between contiguous high-water and sparse max. */
  gaps(): Record<string, number[]> {
    const seen = new Map<string, Set<number>>();
    for (const e of this.entries.values()) {
      let bucket = seen.get(e.replicaId);
      if (!bucket) {
        bucket = new Set<number>();
        seen.set(e.replicaId, bucket);
      }
      bucket.add(e.lamport);
    }
    const out: Record<string, number[]> = {};
    for (const [rid, lamports] of seen) {
      let contiguous = 0;
      while (lamports.has(contiguous + 1)) contiguous++;
      let sparseMax = 0;
      for (const l of lamports) if (l > sparseMax) sparseMax = l;
      const missing: number[] = [];
      for (let l = contiguous + 1; l < sparseMax; l++) {
        if (!lamports.has(l)) missing.push(l);
      }
      if (missing.length > 0) out[rid] = missing;
    }
    return out;
  }

  /** Drop entries strictly before `beforeLamport`. */
  compact(beforeLamport: number): { dropped: number } {
    if (!Number.isFinite(beforeLamport)) {
      throw new RangeError('beforeLamport must be finite');
    }
    let dropped = 0;
    for (const [id, entry] of this.entries) {
      if (entry.lamport < beforeLamport) {
        this.entries.delete(id);
        dropped++;
      }
    }
    return { dropped };
  }

  /** Restore from a previously persisted snapshot. */
  static fromSnapshot<T>(replicaId: string, snapshot: LogEntry<T>[]): CrdtLog<T> {
    const log = new CrdtLog<T>(replicaId);
    log.merge(snapshot);
    return log;
  }
}
