/**
 * @hrkit/sync — Local-first append-only CRDT sync.
 *
 * Re-exports from focused modules:
 *   - crdt-log.ts   — CrdtLog, LogEntry, SyncLogger
 *   - stores.ts     — SyncStore, MemoryStore, IndexedDBStore
 *   - engine.ts     — SyncEngine, SyncMessage, SyncTransport
 *   - transports.ts — WebSocket, Reconnecting, MockPair
 */

// CrdtLog
export type { LogEntry, SyncLogger } from './crdt-log.js';
export { CrdtLog, NoopSyncLogger } from './crdt-log.js';
// Engine & wire format
export type { SyncMessage, SyncTransport } from './engine.js';
export { SYNC_WIRE_VERSION, SyncEngine } from './engine.js';
// Storage
export type { DisposableSyncStore, SyncStore } from './stores.js';
export { createIndexedDBStore, MemoryStore } from './stores.js';
// Transports
export type { MockTransportOptions, ReconnectOptions } from './transports.js';
export {
  createMockTransportPair,
  ReconnectingWebSocketSyncTransport,
  WebSocketSyncTransport,
} from './transports.js';
export { SDK_NAME, SDK_VERSION } from './version.js';
