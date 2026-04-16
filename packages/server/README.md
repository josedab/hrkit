# @hrkit/server

Streaming HR data server for @hrkit — broadcasts heart rate data to WebSocket and SSE clients in real time.

## Install

```bash
npm install @hrkit/server
# or
pnpm add @hrkit/server
```

For WebSocket support, install `ws` as a peer dependency:

```bash
npm install ws
```

## Quick Start

```typescript
import { HRStreamServer } from '@hrkit/server';
import { connectToDevice, MockTransport } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

const server = new HRStreamServer({ port: 8765 });
await server.start();

// Feed HR data from a BLE connection
const transport = new MockTransport(fixtureData);
const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });

for await (const packet of conn.heartRate()) {
  server.broadcast(packet, {
    zone: 3,
    trimp: 42.5,
    rmssd: 58.2,
  });
}

await server.stop();
```

## API Reference

### `HRStreamServer`

#### Constructor

```typescript
new HRStreamServer(config?: StreamServerConfig)
```

#### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `8765` | Port to listen on |
| `host` | `string` | `'127.0.0.1'` | Host to bind to (localhost-only by default) |
| `enableWebSocket` | `boolean` | `true` | Enable WebSocket broadcasting (requires `ws`) |
| `enableSSE` | `boolean` | `true` | Enable SSE endpoint at `/sse` |
| `cors` | `boolean` | `true` | Enable CORS headers |
| `maxRateHz` | `number` | `10` | Maximum broadcast rate (packets per second) |
| `authToken` | `string` | `''` | Auth token — clients must pass as `?token=xxx` |

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the server. Returns a `Promise<void>`. |
| `stop()` | Stop the server and disconnect all clients. |
| `broadcast(packet, extra?)` | Broadcast an `HRPacket` to all clients (respects `maxRateHz` throttling). |
| `broadcastRaw(payload)` | Broadcast a raw `BroadcastPayload` (bypasses rate limiting). |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isRunning` | `boolean` | Whether the server is currently running |
| `clientCount` | `number` | Total connected clients (WebSocket + SSE) |
| `wsClientCount` | `number` | Connected WebSocket clients |
| `sseClientCount` | `number` | Connected SSE clients |

### `BroadcastPayload`

Each broadcast sends a JSON object:

```typescript
interface BroadcastPayload {
  timestamp: number;       // Packet timestamp
  hr: number;              // Heart rate in BPM
  rrIntervals: number[];   // RR intervals in ms
  zone?: number;           // HR zone (1-5)
  trimp?: number;          // Cumulative TRIMP
  rmssd?: number;          // Rolling rMSSD
  custom?: Record<string, unknown>;
}
```

## WebSocket Example

```typescript
// Server
const server = new HRStreamServer({ port: 8765 });
await server.start();
```

```javascript
// Browser client
const ws = new WebSocket('ws://localhost:8765');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`HR: ${data.hr} bpm, Zone: ${data.zone}`);
};
```

## SSE Example

```typescript
// Server
const server = new HRStreamServer({ port: 8765, enableWebSocket: false });
await server.start();
```

```javascript
// Browser client
const source = new EventSource('http://localhost:8765/sse');
source.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`HR: ${data.hr} bpm`);
};
```

## Authentication

Set `authToken` to require clients to authenticate:

```typescript
const server = new HRStreamServer({ authToken: 'my-secret-token' });
await server.start();
```

Clients connect with the token as a query parameter:

```javascript
// WebSocket
const ws = new WebSocket('ws://localhost:8765?token=my-secret-token');

// SSE
const source = new EventSource('http://localhost:8765/sse?token=my-secret-token');
```

Unauthenticated requests receive a `401 Unauthorized` response.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check — returns `{ status: "ok", clients: N }` |
| `/sse` | GET | SSE event stream (when enabled) |
| WebSocket | `ws://` upgrade | WebSocket connection (when enabled) |

## Security Note

The server binds to `127.0.0.1` by default. **Do not expose to public networks without adding proper authentication and TLS.** If you need external access, set `host: '0.0.0.0'` and use a reverse proxy with HTTPS.

## License

MIT
