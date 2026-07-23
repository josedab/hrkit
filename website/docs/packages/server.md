---
title: "@hrkit/server"
description: "Streaming HR data server for @hrkit — WebSocket and SSE broadcasting"
---

# @hrkit/server

Streaming HR data server for @hrkit — WebSocket and SSE broadcasting

## Install

```bash
pnpm add @hrkit/server
```

## Key features

- **WebSocket + SSE** — dual-protocol broadcasting of live HR data
- **Room store** — multi-client room management for group sessions
- **WebRTC signaling** — built-in signaling for peer-to-peer connections

## Quick example

```typescript
import { HRStreamServer } from '@hrkit/server';

const server = new HRStreamServer({ port: 3000 });
await server.start();

// Broadcast HR data to all connected clients
server.broadcast({
  hr: 142,
  timestamp: Date.now(),
  rrIntervals: [],
  contactDetected: true,
});

console.log('HR server listening on ws://localhost:3000');
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/server#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/server`](https://github.com/josedab/hrkit/tree/main/packages/server) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/server)
