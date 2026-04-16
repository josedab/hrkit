import type {
  BLETransport,
  DeviceProfile,
  HRConnection,
  ReadableStream,
  Unsubscribe,
} from './types.js';
import { ConnectionError } from './errors.js';

// ── Connection State ────────────────────────────────────────────────────

/** Connection lifecycle states. */
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/** A connection wrapper that exposes observable connection state. */
export interface ManagedConnection {
  /** The underlying HR connection (null when disconnected/reconnecting). */
  readonly connection: HRConnection | null;
  /** Observable connection state. */
  readonly state$: ReadableStream<ConnectionState>;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Disconnect and stop any reconnection attempts. */
  disconnect(): Promise<void>;
}

// Minimal inline stream (avoids importing SessionRecorder internals)
class StateStream<T> implements ReadableStream<T> {
  private listeners = new Set<(value: T) => void>();
  private current: T | undefined;

  constructor(initial?: T) {
    this.current = initial;
  }

  subscribe(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener);
    if (this.current !== undefined) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  get(): T | undefined {
    return this.current;
  }

  emit(value: T): void {
    this.current = value;
    for (const listener of this.listeners) listener(value);
  }
}

// ── Reconnection ────────────────────────────────────────────────────────

/** Configuration for automatic reconnection. */
export interface ReconnectConfig {
  /** Maximum reconnection attempts before giving up. Default: 5. */
  maxAttempts?: number;
  /** Initial delay between attempts in ms. Default: 1000. */
  initialDelayMs?: number;
  /** Maximum delay between attempts in ms. Default: 30000. */
  maxDelayMs?: number;
  /** Backoff multiplier applied to delay on each retry. Default: 1.5. */
  backoffMultiplier?: number;
}

/**
 * Connect to a device with automatic retry on initial connection failure.
 * Retries with exponential backoff up to maxAttempts.
 *
 * Returns a ManagedConnection that tracks connection state.
 * Note: this retries the initial connection only. It does not
 * automatically reconnect after a successful connection is lost.
 *
 * @throws {ConnectionError} if all retry attempts are exhausted.
 */
export async function connectWithRetry(
  transport: BLETransport,
  deviceId: string,
  profile: DeviceProfile,
  config: ReconnectConfig = {},
): Promise<ManagedConnection> {
  const {
    maxAttempts = 5,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 1.5,
  } = config;

  const stateStream = new StateStream<ConnectionState>('idle');
  let currentConn: HRConnection | null = null;
  let stopped = false;

  async function attemptConnect(): Promise<HRConnection> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxAttempts) {
      if (stopped) throw new ConnectionError('Connection stopped by user');

      try {
        stateStream.emit(attempt === 0 ? 'connecting' : 'reconnecting');
        const conn = await transport.connect(deviceId, profile);
        stateStream.emit('connected');
        return conn;
      } catch (err) {
        attempt++;
        if (attempt >= maxAttempts) {
          stateStream.emit('disconnected');
          throw new ConnectionError(
            `Failed to connect after ${maxAttempts} attempts: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await new Promise<void>((r) => setTimeout(r, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }

    throw new ConnectionError('Max reconnection attempts exceeded');
  }

  currentConn = await attemptConnect();

  const managed: ManagedConnection = {
    get connection() {
      return currentConn;
    },

    state$: stateStream,

    get state() {
      return stateStream.get() ?? 'idle';
    },

    async disconnect() {
      stopped = true;
      if (currentConn) {
        await currentConn.disconnect();
        currentConn = null;
      }
      stateStream.emit('disconnected');
    },
  };

  return managed;
}

/**
 * @deprecated Use `connectWithRetry` instead. This alias will be removed in a future version.
 */
export const connectWithReconnect = connectWithRetry;
