---
title: "@hrkit/sync"
description: "Local-first append-only CRDT sync for @hrkit sessions. Zero deps."
---

# @hrkit/sync

Local-first append-only CRDT sync for @hrkit sessions. Zero deps.

## Install

```bash
pnpm add @hrkit/sync
```

## Key features

- **Local-first CRDT** — append-only conflict-free replication for sessions
- **IndexedDB store** — offline-capable persistence in the browser
- **Reconnecting transport** — automatic retry with exponential backoff

## Quick example

```typescript
import { CrdtLog, createIndexedDBStore } from '@hrkit/sync';

type HeartRateSample = { timestamp: number; hr: number };
const store = createIndexedDBStore<HeartRateSample>('hrkit', 'session-42');
const log = new CrdtLog<HeartRateSample>('watch');

log.append({ timestamp: Date.now(), hr: 142 });
await store.save(log.snapshot());
const restored = await store.load();
store.close();
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/sync#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/sync`](https://github.com/josedab/hrkit/tree/main/packages/sync) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/sync)
