import type {
  BLETransport,
  DeviceProfile,
  HRConnection,
  ReadableStream,
} from './types.js';
import { ConnectionError } from './errors.js';
import { SimpleStream } from './stream.js';

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
 * @param transport - Platform-specific BLE transport implementation.
 * @param deviceId - BLE device identifier to connect to.
 * @param profile - Device profile describing capabilities and service UUIDs.
 * @param config - Optional reconnection parameters (maxAttempts, delays, backoff).
 * @returns A {@link ManagedConnection} wrapping the connected device.
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

  const stateStream = new SimpleStream<ConnectionState>();
  stateStream.emit('idle');
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
        // Exponential backoff with ±10% jitter to prevent thundering herd
        const jitter = delay * (0.9 + Math.random() * 0.2);
        delay = Math.min(jitter * backoffMultiplier, maxDelayMs);
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
