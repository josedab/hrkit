import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { HRPacket } from '@hrkit/core';

// ── Public types ────────────────────────────────────────────────────────

/** Data broadcast to clients on each HR packet. */
export interface BroadcastPayload {
  /** Timestamp of the HR packet. */
  timestamp: number;
  /** Heart rate in BPM. */
  hr: number;
  /** RR intervals in ms. */
  rrIntervals: number[];
  /** Current HR zone (1-5), if zone config provided. */
  zone?: number;
  /** Cumulative TRIMP, if config provided. */
  trimp?: number;
  /** Rolling rMSSD, if available. */
  rmssd?: number;
  /** Custom data from user. */
  custom?: Record<string, unknown>;
}

/** Extra metrics to include alongside an HRPacket broadcast. */
export interface BroadcastExtra {
  zone?: number;
  trimp?: number;
  rmssd?: number;
  custom?: Record<string, unknown>;
}

/** Configuration for the HR streaming server. */
export interface StreamServerConfig {
  /** Port to listen on. Default: 8765. */
  port?: number;
  /** Host to bind to. Default: '127.0.0.1' (local only for security). */
  host?: string;
  /** Enable WebSocket broadcasting. Default: true. Requires `ws` package. */
  enableWebSocket?: boolean;
  /** Enable SSE endpoint at /sse. Default: true. */
  enableSSE?: boolean;
  /** Enable CORS headers. Default: true. */
  cors?: boolean;
  /** Maximum broadcast rate in Hz (packets per second). Default: 10. */
  maxRateHz?: number;
  /** Authentication token. If set, clients must provide it as ?token=xxx query param. */
  authToken?: string;
}

// ── Pure helpers (exported for testing) ─────────────────────────────────

/** Build a BroadcastPayload from an HRPacket and optional extras. */
export function buildPayload(packet: HRPacket, extra?: BroadcastExtra): BroadcastPayload {
  const payload: BroadcastPayload = {
    timestamp: packet.timestamp,
    hr: packet.hr,
    rrIntervals: packet.rrIntervals,
  };
  if (extra?.zone !== undefined) payload.zone = extra.zone;
  if (extra?.trimp !== undefined) payload.trimp = extra.trimp;
  if (extra?.rmssd !== undefined) payload.rmssd = extra.rmssd;
  if (extra?.custom !== undefined) payload.custom = extra.custom;
  return payload;
}

// ── Resolved config with defaults ───────────────────────────────────────

type ResolvedConfig = Required<StreamServerConfig>;

function resolveConfig(config?: StreamServerConfig): ResolvedConfig {
  return {
    port: config?.port ?? 8765,
    host: config?.host ?? '127.0.0.1',
    enableWebSocket: config?.enableWebSocket ?? true,
    enableSSE: config?.enableSSE ?? true,
    cors: config?.cors ?? true,
    maxRateHz: config?.maxRateHz ?? 10,
    authToken: config?.authToken ?? '',
  };
}

// ── CORS helper ─────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Auth helper ─────────────────────────────────────────────────────────

function checkAuth(url: URL, authToken: string): boolean {
  if (!authToken) return true;
  return url.searchParams.get('token') === authToken;
}

// ── HRStreamServer ──────────────────────────────────────────────────────

/**
 * Streaming HR data server.
 * Broadcasts HR packets to connected WebSocket and SSE clients.
 *
 * @example
 * ```typescript
 * const server = new HRStreamServer({ port: 8765 });
 * await server.start();
 *
 * // Feed HR data
 * for await (const packet of connection.heartRate()) {
 *   server.broadcast(packet);
 * }
 *
 * await server.stop();
 * ```
 */
export class HRStreamServer {
  private readonly config: ResolvedConfig;
  private httpServer: ReturnType<typeof createServer> | null = null;
  /**
   * WebSocket server instance. Typed loosely since `ws` is an optional peer dependency
   * loaded dynamically — the concrete type is `WebSocketServer` from the `ws` package.
   */
  // biome-ignore lint/suspicious/noExplicitAny: ws types unavailable at compile time; runtime-checked
  private wsServer: Record<string, any> | null = null;
  private readonly sseClients: Set<ServerResponse> = new Set();
  private lastBroadcastTime = 0;
  private running = false;

  /** Number of connected WebSocket clients. */
  get wsClientCount(): number {
    return this.wsServer?.clients?.size ?? 0;
  }

  /** Number of connected SSE clients. */
  get sseClientCount(): number {
    return this.sseClients.size;
  }

  /** Total connected clients (WebSocket + SSE). */
  get clientCount(): number {
    return this.wsClientCount + this.sseClientCount;
  }

  /** Whether the server is running. */
  get isRunning(): boolean {
    return this.running;
  }

  constructor(config?: StreamServerConfig) {
    this.config = resolveConfig(config);
  }

  /** Start the server. */
  async start(): Promise<void> {
    if (this.running) return;

    this.httpServer = createServer((req, res) => this.handleRequest(req, res));

    // Optionally attach WebSocket server
    if (this.config.enableWebSocket) {
      await this.attachWebSocket();
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        this.httpServer!.removeListener('error', reject);
        resolve();
      });
    });

    this.running = true;
  }

  /** Stop the server and disconnect all clients. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Close SSE clients
    for (const res of this.sseClients) {
      res.end();
    }
    this.sseClients.clear();

    // Close WebSocket server
    if (this.wsServer) {
      for (const client of this.wsServer.clients) {
        client.close();
      }
      await new Promise<void>((resolve) => {
        this.wsServer!.close(() => resolve());
      });
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }
  }

  /**
   * Broadcast an HR packet to all connected clients.
   * Respects maxRateHz throttling.
   */
  broadcast(packet: HRPacket, extra?: BroadcastExtra): void {
    const now = Date.now();
    const minInterval = 1000 / this.config.maxRateHz;
    if (now - this.lastBroadcastTime < minInterval) return;

    this.broadcastRaw(buildPayload(packet, extra));
  }

  /** Broadcast a raw payload object (bypasses rate limiting). */
  broadcastRaw(payload: BroadcastPayload): void {
    const json = JSON.stringify(payload);
    this.lastBroadcastTime = Date.now();

    // WebSocket clients
    if (this.wsServer) {
      for (const client of this.wsServer.clients) {
        if (client.readyState === 1 /* WebSocket.OPEN */) {
          client.send(json);
        }
      }
    }

    // SSE clients
    for (const res of this.sseClients) {
      res.write(`data: ${json}\n\n`);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (this.config.cors) {
      setCorsHeaders(res);
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = url.pathname;

    if (pathname === '/health' && req.method === 'GET') {
      this.handleHealth(res);
    } else if (pathname === '/sse' && req.method === 'GET') {
      this.handleSSE(url, req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private handleHealth(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: this.clientCount }));
  }

  private handleSSE(url: URL, _req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.enableSSE) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSE disabled' }));
      return;
    }

    if (!checkAuth(url, this.config.authToken)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    this.sseClients.add(res);

    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  private async attachWebSocket(): Promise<void> {
    try {
      const ws = await import('ws');
      const WSServer = ws.WebSocketServer;
      this.wsServer = new WSServer({ noServer: true });

      this.httpServer!.on('upgrade', (req: IncomingMessage, socket, head) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        if (!checkAuth(url, this.config.authToken)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wsServer!.handleUpgrade(req, socket, head, (client: unknown) => {
          this.wsServer!.emit('connection', client, req);
        });
      });
    } catch {
      // ws package not installed — WebSocket support disabled
      this.wsServer = null;
    }
  }
}
export * from './webrtc.js';
