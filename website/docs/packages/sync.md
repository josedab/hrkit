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
import { SyncStore } from '@hrkit/sync';

const store = new SyncStore({ url: 'wss://sync.example.com' });
await store.push(session);      // upload when online
const all = await store.list(); // read from local cache when offline
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/sync#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/sync`](https://github.com/josedab/hrkit/tree/main/packages/sync) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/sync)
