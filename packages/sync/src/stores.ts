/**
 * Pluggable storage providers for CRDT log persistence.
 */

import type { LogEntry } from './crdt-log.js';

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

/** {@link SyncStore} with an explicit teardown hook. */
export interface DisposableSyncStore<T = unknown> extends SyncStore<T> {
  /** Release any underlying connection. Subsequent calls reopen lazily. */
  close(): void;
}

/**
 * IndexedDB-backed store factory. Returns a {@link DisposableSyncStore} bound
 * to a specific DB + object-store name. Caller must run inside a browser;
 * throws synchronously if `indexedDB` isn't available.
 */
export function createIndexedDBStore<T = unknown>(dbName: string, storeName = 'hrkit-sync'): DisposableSyncStore<T> {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) throw new Error('IndexedDB is not available in this runtime');

  let cached: IDBDatabase | undefined;
  let openP: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    if (cached) return Promise.resolve(cached);
    if (openP) return openP;
    openP = new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb!.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => {
        cached = req.result;
        cached.onclose = () => {
          cached = undefined;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        openP = undefined;
        reject(req.error);
      };
    });
    return openP;
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
    close() {
      cached?.close();
      cached = undefined;
      openP = undefined;
    },
  };
}
