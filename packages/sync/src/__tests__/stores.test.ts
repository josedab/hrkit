import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import type { LogEntry } from '../crdt-log.js';
import { createIndexedDBStore } from '../stores.js';

const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
let databaseId = 0;

function installIndexedDB(): void {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: fakeIndexedDB,
  });
}

function nextDatabaseName(): string {
  databaseId += 1;
  return `hrkit-sync-test-${databaseId}`;
}

afterEach(() => {
  if (originalIndexedDB) {
    Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
  } else {
    Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});

describe('createIndexedDBStore', () => {
  it('rejects runtimes without IndexedDB', () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    expect(() => createIndexedDBStore('unsupported')).toThrow(/IndexedDB is not available/);
  });

  it('loads an empty store and round-trips snapshots', async () => {
    installIndexedDB();
    const store = createIndexedDBStore<number>(nextDatabaseName());
    const snapshot: LogEntry<number>[] = [{ id: 'a:1', replicaId: 'a', lamport: 1, payload: 42 }];

    expect(await store.load()).toEqual([]);
    await store.save(snapshot);
    expect(await store.load()).toEqual(snapshot);
    store.close();
  });

  it('reopens lazily after close without losing data', async () => {
    installIndexedDB();
    const store = createIndexedDBStore<string>(nextDatabaseName());
    const snapshot: LogEntry<string>[] = [{ id: 'a:1', replicaId: 'a', lamport: 1, payload: 'persisted' }];

    await store.save(snapshot);
    store.close();

    expect(await store.load()).toEqual(snapshot);
    store.close();
  });

  it('creates and isolates multiple object stores in one database', async () => {
    installIndexedDB();
    const databaseName = nextDatabaseName();
    const first = createIndexedDBStore<number>(databaseName, 'first');
    const second = createIndexedDBStore<number>(databaseName, 'second');
    const firstSnapshot: LogEntry<number>[] = [{ id: 'a:1', replicaId: 'a', lamport: 1, payload: 1 }];
    const secondSnapshot: LogEntry<number>[] = [{ id: 'b:1', replicaId: 'b', lamport: 1, payload: 2 }];

    await first.save(firstSnapshot);
    await second.save(secondSnapshot);

    expect(await first.load()).toEqual(firstSnapshot);
    expect(await second.load()).toEqual(secondSnapshot);
    first.close();
    second.close();
  });
});
