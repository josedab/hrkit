---
sidebar_position: 7
title: Streaming Server
description: Broadcast live HR data over WebSocket and SSE with @hrkit/server.
---

# Streaming Server

`@hrkit/server` broadcasts live heart rate data to browser clients over WebSocket and/or Server-Sent Events (SSE). Use it to build live dashboards, coaching displays, or multi-screen setups.

## Install

```bash
npm install @hrkit/server
# For WebSocket support:
npm install ws
```

## Quick Start

```typescript
import { HRStreamServer } from '@hrkit/server';
import { SessionRecorder, connectToDevice, MockTransport } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

// Start the server
const server = new HRStreamServer({ port: 8765 });
await server.start();

// Connect to a BLE device (or use MockTransport)
const transport = new MockTransport(fixtureData);
const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

// Broadcast each HR packet to all connected clients
for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
  server.broadcast(packet, {
    zone: recorder.currentZone() ?? undefined,
  });
}

await server.stop();
```

## Configuration

```typescript
const server = new HRStreamServer({
  port: 8765,              // default
  host: '127.0.0.1',       // localhost only by default
  enableWebSocket: true,    // requires `ws` package
  enableSSE: true,          // SSE endpoint at /sse
  cors: true,               // CORS headers enabled
  maxRateHz: 10,            // throttle broadcasts
  authToken: '',            // set to require ?token=xxx
});
```

## Browser Clients

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`HR: ${data.hr} bpm, Zone: ${data.zone}`);
};
```

### Server-Sent Events

```javascript
const source = new EventSource('http://localhost:8765/sse');
source.onmessage = (event) => {
  const data = JSON.parse(event.data);
  document.getElementById('hr').textContent = data.hr;
};
```

## Authentication

```typescript
const server = new HRStreamServer({ authToken: 'my-secret' });
await server.start();
```

Clients must include the token:

```javascript
const ws = new WebSocket('ws://localhost:8765?token=my-secret');
const sse = new EventSource('http://localhost:8765/sse?token=my-secret');
```

Unauthenticated connections receive `401 Unauthorized`.

## Broadcast Payload

Each broadcast sends a JSON object:

```typescript
interface BroadcastPayload {
  timestamp: number;       // packet timestamp
  hr: number;              // BPM
  rrIntervals: number[];   // milliseconds
  zone?: number;           // HR zone (1-5)
  trimp?: number;          // cumulative TRIMP
  rmssd?: number;          // rolling rMSSD
  custom?: Record<string, unknown>;
}
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Returns `{ status: "ok", clients: N }` |
| `/sse` | GET | SSE event stream |
| `ws://` | WebSocket | WebSocket connection |

## Security

The server binds to `127.0.0.1` by default. **Do not expose to public networks** without TLS and authentication. Use a reverse proxy (nginx, Caddy) for production.

## Next steps

- **[Dashboard Widgets](./widgets)** — Display streamed data with drop-in Web Components
- **[Group Sessions](./group-sessions)** — Broadcast multi-athlete sessions to a coach dashboard
- **[Streaming Metrics](./streaming-metrics)** — Compute real-time HRV and TRIMP from the live stream
