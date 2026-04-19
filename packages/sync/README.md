# @hrkit/sync

Local-first append-only CRDT sync for @hrkit sessions. Zero deps.

Part of the [@hrkit](https://github.com/josedab/hrkit) monorepo — a platform-agnostic TypeScript SDK for BLE heart-rate sensors.

## Install

```bash
npm install @hrkit/sync
```

## Quickstart

### Local CRDT log

Each replica owns an append-only log keyed by a stable `replicaId`. Merge is commutative, associative, and idempotent — exchange snapshots in any order, any number of times.

```ts
import { CrdtLog } from '@hrkit/sync';

const a = new CrdtLog<number>('watch');
const b = new CrdtLog<number>('phone');

a.append(142);            // hr sample
b.append(99);

a.merge(b.snapshot());    // a now has both
b.merge(a.snapshot());    // b converges
```

### Persistence

Pair an engine with a `SyncStore` to get write-through persistence. Saves are coalesced — a burst of `append`s flushes as a single `store.save`.

```ts
import { CrdtLog, SyncEngine, MemoryStore, createIndexedDBStore } from '@hrkit/sync';

const store = createIndexedDBStore<HrSample>('hrkit', 'session-42');
const log = new CrdtLog<HrSample>('watch');
const engine = new SyncEngine(log, transport, { store });

await engine.start();          // hydrates from store
engine.append({ t: now(), hr: 142 });
await engine.flush();          // wait for persists
```

### Reconnecting WebSocket transport

```ts
import { SyncEngine, CrdtLog, ReconnectingWebSocketSyncTransport } from '@hrkit/sync';

const transport = new ReconnectingWebSocketSyncTransport<HrSample>(
  () => new WebSocket('wss://sync.example.com/ws'),
  { initialDelayMs: 500, maxDelayMs: 30_000, jitter: 0.2 },
);

const engine = new SyncEngine(new CrdtLog<HrSample>('watch'), transport);
await engine.start();
```

Outbound messages sent while disconnected are buffered (default 256) and flushed on reconnect. Buffer overflow surfaces via the optional `logger.warn('hrkit.sync.send_dropped')`.

### Per-replica cursor handshake

`SyncEngine.start()` advertises a per-replica cursor map (`{ replicaId: highestLamport }`). Peers reply with only the entries you're missing — no full-snapshot retransmits when reconnecting an established session.

### Compaction

Once entries are durably persisted (or shipped to all peers), drop them locally:

```ts
const { dropped } = log.compact(/* beforeLamport */ 1000);
```

The Lamport clock is preserved so subsequent appends remain monotonic.

For automatic bounded storage, pass `autoPrune` to the engine:

```ts
const engine = new SyncEngine(log, transport, {
  store,
  autoPrune: { maxEntries: 10_000 },
});
```

After every persist the engine compacts oldest entries down to the cap. Prune runs **before** save, so the persisted snapshot always matches the in-memory state.

> ⚠️ **Tradeoff:** Compacted entries can no longer be replayed via the cursor handshake. Use `autoPrune` only when peers are guaranteed to have caught up via another channel (for example: a server that forwards every `delta` to long-term storage immediately). For pure peer-to-peer topologies, prefer manual `log.compact()` after explicit acknowledgement from every peer.

## Wire format

`SyncMessage` is JSON-encoded by the built-in transports. Every outbound message stamps a numeric `v` field carrying {@link SYNC_WIRE_VERSION} (currently `1`). Receivers should treat `v === undefined` as legacy v0 and fall back to the single-cursor decoding path. Future incompatible changes will bump `v` and ship a parallel decode path; additive changes will keep the same `v` and rely on `?` fields.

`CrdtLog.cursors()` advertises the **contiguous** high-water mark per replica — it stops at the first gap. This makes the `hello`/`delta` handshake self-healing: if any individual delta is dropped, the next handshake re-requests it (along with the few entries above it that the receiver already has). `merge()` is idempotent so the duplicate entries cost only bandwidth, not correctness.

For debugging, `CrdtLog.gaps()` returns a `Record<replicaId, missingLamports[]>` of every missing lamport between the contiguous cursor and the sparse maximum. It returns `{}` when nothing is outstanding — handy for surfacing stuck convergence in observability dashboards.

## Testing

`createMockTransportPair<T>(options?)` returns a pair of in-memory transports
suitable for testing your own `SyncEngine` integrations without a real
WebSocket. Optional `dropRate` and `latencyMs` enable fault injection.

```ts
import { createMockTransportPair, CrdtLog, SyncEngine } from '@hrkit/sync';

const [tA, tB] = createMockTransportPair<number>({ dropRate: 0.1 });
const eA = new SyncEngine(new CrdtLog('a'), tA);
const eB = new SyncEngine(new CrdtLog('b'), tB);
await eA.start();
await eB.start();
```

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/sync/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
