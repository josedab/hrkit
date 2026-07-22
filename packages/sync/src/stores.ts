/**
 * Pluggable storage providers for CRDT log persistence.
 */

import { HRKitError } from '@hrkit/core';
import type { LogEntry } from './crdt-log.js';

export interface SyncStore<T = unknown> {
  load(): Promise<LogEntry<T>[]>;
  save(snapshot: LogEntry<T>[]): Promise<void>;
}

/** In-memory {@link SyncStore} — useful for tests and ephemeral sessions. */
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
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (factory === undefined) throw new HRKitError('IndexedDB is not available in this runtime', 'ENV_UNSUPPORTED');
  const indexedDBFactory: IDBFactory = factory;

  let cached: IDBDatabase | undefined;
  let openP: Promise<IDBDatabase> | undefined;

  function requestDatabase(version?: number): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = version === undefined ? indexedDBFactory.open(dbName) : indexedDBFactory.open(dbName, version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function connect(): Promise<IDBDatabase> {
    let database = await requestDatabase();
    if (!database.objectStoreNames.contains(storeName)) {
      const nextVersion = database.version + 1;
      database.close();
      database = await requestDatabase(nextVersion);
    }

    const release = () => {
      if (cached === database) cached = undefined;
    };
    database.onversionchange = () => {
      release();
      database.close();
    };
    database.onclose = release;
    return database;
  }

  function open(): Promise<IDBDatabase> {
    if (cached) return Promise.resolve(cached);
    if (openP) return openP;
    openP = connect().then(
      (database) => {
        cached = database;
        openP = undefined;
        return database;
      },
      (error: unknown) => {
        openP = undefined;
        throw error;
      },
    );
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
