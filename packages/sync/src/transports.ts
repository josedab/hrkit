/**
 * WebSocket-based sync transports.
 *
 * Includes a basic transport, a reconnecting transport with exponential
 * backoff + jitter, and mock transport pairs for testing.
 */

import { NoopSyncLogger, type SyncLogger } from './crdt-log.js';
import type { SyncMessage, SyncTransport } from './engine.js';

// ── WebSocket Transport ─────────────────────────────────────────────────

/** WebSocket transport. Frames are JSON-serialized {@link SyncMessage}s. */
export class WebSocketSyncTransport<T = unknown> implements SyncTransport<T> {
  private handlers: Array<(msg: SyncMessage<T>) => void> = [];
  private readonly logger: SyncLogger;
  private readonly messageHandler: (ev: MessageEvent) => void;

  constructor(
    private readonly socket: WebSocket,
    options?: { logger?: SyncLogger },
  ) {
    this.logger = options?.logger ?? NoopSyncLogger;
    this.messageHandler = (ev: MessageEvent) => {
      try {
        const data = typeof ev.data === 'string' ? ev.data : '';
        const msg = JSON.parse(data) as SyncMessage<T>;
        for (const h of this.handlers) h(msg);
      } catch {
        /* ignore malformed */
      }
    };
    socket.addEventListener('message', this.messageHandler);
  }

  send(msg: SyncMessage<T>): void {
    const s = this.socket;
    if (s.readyState === s.OPEN) {
      s.send(JSON.stringify(msg));
      return;
    }
    if (s.readyState === s.CONNECTING) {
      s.addEventListener('open', () => s.send(JSON.stringify(msg)), { once: true });
      return;
    }
    this.logger.warn('hrkit.sync.send_dropped', {
      reason: s.readyState === s.CLOSING ? 'closing' : 'closed',
      type: msg.type,
      replicaId: msg.replicaId,
    });
  }

  onMessage(handler: (msg: SyncMessage<T>) => void): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.socket.removeEventListener('message', this.messageHandler);
    this.socket.close();
  }
}

// ── Reconnecting WebSocket Transport ────────────────────────────────────

/** Options for {@link ReconnectingWebSocketSyncTransport}. */
export interface ReconnectOptions {
  /** Initial backoff in ms. Default: 500. */
  initialDelayMs?: number;
  /** Multiplier applied per failed attempt. Default: 2. */
  factor?: number;
  /** Cap for the backoff in ms. Default: 30_000. */
  maxDelayMs?: number;
  /** Max ± jitter as a fraction of the delay. Default: 0.2. */
  jitter?: number;
  /** Hard cap on consecutive reconnect attempts; 0 = unlimited. Default: 0. */
  maxAttempts?: number;
  /** Diagnostics sink. */
  logger?: SyncLogger;
}

/**
 * {@link SyncTransport} that wraps a WebSocket factory and automatically
 * reconnects with exponential backoff + jitter when the underlying socket
 * closes unexpectedly.
 */
export class ReconnectingWebSocketSyncTransport<T = unknown> implements SyncTransport<T> {
  private socket?: WebSocket;
  private handlers: Array<(msg: SyncMessage<T>) => void> = [];
  private buffer: SyncMessage<T>[] = [];
  private attempts = 0;
  private readonly logger: SyncLogger;
  private readonly opts: Required<Omit<ReconnectOptions, 'logger' | 'maxAttempts'>> & {
    maxAttempts: number;
  };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly factory: () => WebSocket,
    options?: ReconnectOptions & { maxBufferedMessages?: number },
    private readonly maxBufferedMessages = options?.maxBufferedMessages ?? 256,
  ) {
    this.logger = options?.logger ?? NoopSyncLogger;
    this.opts = {
      initialDelayMs: options?.initialDelayMs ?? 500,
      factor: options?.factor ?? 2,
      maxDelayMs: options?.maxDelayMs ?? 30_000,
      jitter: options?.jitter ?? 0.2,
      maxAttempts: options?.maxAttempts ?? 0,
    };
    this.connect();
  }

  send(msg: SyncMessage<T>): void {
    const s = this.socket;
    if (s && s.readyState === s.OPEN) {
      s.send(JSON.stringify(msg));
      return;
    }
    if (this.buffer.length >= this.maxBufferedMessages) {
      this.logger.warn('hrkit.sync.send_dropped', {
        reason: 'buffer_full',
        type: msg.type,
        replicaId: msg.replicaId,
        bufferedMessages: this.buffer.length,
      });
      return;
    }
    this.buffer.push(msg);
  }

  onMessage(handler: (msg: SyncMessage<T>) => void): void {
    this.handlers.push(handler);
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close();
  }

  get connected(): boolean {
    const s = this.socket;
    return !!s && s.readyState === s.OPEN;
  }
  get bufferedMessageCount(): number {
    return this.buffer.length;
  }
  get reconnectAttempts(): number {
    return this.attempts;
  }

  private connect(): void {
    if (this.closed) return;

    let s: WebSocket;
    try {
      s = this.factory();
    } catch (err) {
      this.scheduleReconnect(err);
      return;
    }
    this.socket = s;

    const onOpen = (): void => {
      this.attempts = 0;
      this.flushBuffer();
    };
    const onMessage = (ev: MessageEvent): void => {
      try {
        const data = typeof ev.data === 'string' ? ev.data : '';
        const msg = JSON.parse(data) as SyncMessage<T>;
        for (const h of this.handlers) h(msg);
      } catch {
        /* ignore malformed */
      }
    };
    const onClose = (): void => {
      // Only reconnect if this is still the active socket
      if (!this.closed && this.socket === s) this.scheduleReconnect(undefined);
    };
    const onError = (): void => {
      this.logger.warn('hrkit.sync.socket_error', { attempts: this.attempts });
    };

    s.addEventListener('open', onOpen);
    s.addEventListener('message', onMessage);
    s.addEventListener('close', onClose);
    s.addEventListener('error', onError);
  }

  private flushBuffer(): void {
    const s = this.socket;
    if (!s || s.readyState !== s.OPEN) return;
    const pending = this.buffer;
    this.buffer = [];
    for (const m of pending) s.send(JSON.stringify(m));
  }

  private scheduleReconnect(err: unknown): void {
    if (this.closed) return;
    this.attempts += 1;
    if (this.opts.maxAttempts > 0 && this.attempts > this.opts.maxAttempts) {
      this.logger.warn('hrkit.sync.reconnect_giveup', { attempts: this.attempts });
      this.closed = true;
      return;
    }
    const base = Math.min(this.opts.maxDelayMs, this.opts.initialDelayMs * this.opts.factor ** (this.attempts - 1));
    const jitterRange = base * this.opts.jitter;
    const delay = Math.max(0, base + (Math.random() * 2 - 1) * jitterRange);
    this.logger.warn('hrkit.sync.reconnect_scheduled', {
      attempts: this.attempts,
      delayMs: Math.round(delay),
      error: err instanceof Error ? err.message : err === undefined ? undefined : String(err),
    });
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.connect();
    }, delay);
  }
}

// ── Test Helpers ────────────────────────────────────────────────────────

export interface MockTransportOptions {
  /** Probability (0..1) that any individual message is dropped. */
  dropRate?: number;
  /** Optional async delay applied to every delivery, in ms. */
  latencyMs?: number;
  /** Deterministic PRNG. Defaults to `Math.random`. */
  random?: () => number;
}

/**
 * In-memory paired transports for testing `SyncEngine` integrations without
 * a real WebSocket.
 */
export function createMockTransportPair<T = unknown>(
  options: MockTransportOptions = {},
): [SyncTransport<T>, SyncTransport<T>] {
  const drop = options.dropRate ?? 0;
  const latency = options.latencyMs ?? 0;
  const rand = options.random ?? Math.random;
  const handlers: { a?: (m: SyncMessage<T>) => void; b?: (m: SyncMessage<T>) => void } = {};
  let closed = false;

  const make = (self: 'a' | 'b'): SyncTransport<T> => {
    const peer = self === 'a' ? 'b' : 'a';
    return {
      send(msg) {
        if (closed) return;
        if (rand() < drop) return;
        const dispatch = () => {
          if (closed) return;
          handlers[peer]?.(msg);
        };
        if (latency > 0) setTimeout(dispatch, latency);
        else dispatch();
      },
      onMessage(h) {
        handlers[self] = h;
      },
      close() {
        closed = true;
      },
    };
  };

  return [make('a'), make('b')];
}
