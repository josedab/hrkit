/**
 * Pluggable logger interface + secret redaction utility.
 *
 * SDK-internal modules call `getLogger()` to obtain the active logger. By
 * default this is a no-op; consumers wire up their own logger via
 * `setLogger()` (typical pattern: pino/winston/console adapter).
 *
 * Every public log path **must** route arguments through `redact()` so
 * tokens, API keys and signed URLs never leak into logs or telemetry.
 */

/** Standard log levels in increasing severity. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal pluggable logger interface. Inspired by pino/bunyan but reduced to
 * the verbs the SDK actually uses. Implement this to wire your preferred
 * logging library (pino, winston, etc.) into the SDK.
 */
export interface Logger {
  /** Log debug-level messages (noisy, for development). */
  debug(msg: string, meta?: Record<string, unknown>): void;
  /** Log informational messages (state transitions, connections). */
  info(msg: string, meta?: Record<string, unknown>): void;
  /** Log warnings (degraded state, retries, artifact spikes). */
  warn(msg: string, meta?: Record<string, unknown>): void;
  /** Log errors (connection failures, parse errors). */
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** No-op logger used when no logger is registered. */
export const NoopLogger: Logger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});

/**
 * Console-backed logger. Useful for examples and tests; not recommended for
 * production where you should plug in a structured logger.
 */
export const ConsoleLogger: Logger = Object.freeze({
  debug: (m: string, meta?: Record<string, unknown>) => console.debug(m, redact(meta)),
  info: (m: string, meta?: Record<string, unknown>) => console.info(m, redact(meta)),
  warn: (m: string, meta?: Record<string, unknown>) => console.warn(m, redact(meta)),
  error: (m: string, meta?: Record<string, unknown>) => console.error(m, redact(meta)),
});

let activeLogger: Logger = NoopLogger;

/**
 * Replace the SDK-wide logger. Pass `NoopLogger` to silence again.
 *
 * @param logger - Logger implementation.
 *
 * @example
 * ```ts
 * import { setLogger, ConsoleLogger } from '@hrkit/core';
 * setLogger(ConsoleLogger); // enable debug output
 * ```
 */
export function setLogger(logger: Logger): void {
  activeLogger = logger;
}

/**
 * Get the SDK-wide logger.
 *
 * @returns The active logger (NoopLogger by default).
 */
export function getLogger(): Logger {
  return activeLogger;
}

// ── Redaction ───────────────────────────────────────────────────────────

const SECRET_KEY_PATTERN =
  /(token|secret|password|api[_-]?key|authorization|auth|client[_-]?secret|access[_-]?key|refresh[_-]?token|bearer|cookie|set-cookie)/i;

/** Match Authorization-style values that look like Bearer/Basic tokens. */
const BEARER_VALUE_PATTERN = /^(bearer|basic)\s+\S+$/i;

/** Inline secret patterns that may appear inside free-form strings. */
const INLINE_SECRET_PATTERNS: RegExp[] = [
  /(authorization\s*[:=]\s*)([^\s,;]+)/gi,
  /(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi,
  /(token\s*[:=]\s*)([^\s,;]+)/gi,
  /(password\s*[:=]\s*)([^\s,;]+)/gi,
];

/** Replacement marker used wherever a secret was redacted. */
export const REDACTED = '[REDACTED]';

/**
 * Recursively redact secrets from arbitrary log payloads. Safe on cyclic
 * structures (tracked via `WeakSet`). Returns a deep copy — never mutates
 * the input.
 */
export function redact<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value) as unknown as T;
  if (typeof value !== 'object') return value;

  if (seen.has(value as object)) return REDACTED as unknown as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, seen)) as unknown as T;
  }
  if (value instanceof Error) {
    // Errors are not plain objects; surface message + name only.
    return new Error(redactString(value.message)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = REDACTED;
      continue;
    }
    if (typeof v === 'string' && BEARER_VALUE_PATTERN.test(v)) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redact(v, seen);
  }
  return out as T;
}

function redactString(s: string): string {
  let out = s;
  for (const pat of INLINE_SECRET_PATTERNS) {
    out = out.replace(pat, (_match, prefix: string) => `${prefix}${REDACTED}`);
  }
  return out;
}
