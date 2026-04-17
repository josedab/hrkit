/**
 * Custom error hierarchy for @hrkit/core.
 * Provides structured, catchable error types for BLE parsing,
 * connection management, and device discovery failures.
 */

/**
 * Base error for all @hrkit errors.
 *
 * @param message - Human-readable error message.
 * @param code - Machine-readable error code.
 */
export class HRKitError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'HRKitError';
    this.code = code;
  }
}

/**
 * Thrown when BLE data cannot be parsed (truncated buffer, invalid format).
 *
 * @param message - Description of the parse failure.
 */
export class ParseError extends HRKitError {
  constructor(message: string, code: string = 'PARSE_ERROR') {
    super(message, code);
    this.name = 'ParseError';
  }
}

/**
 * Thrown when a BLE connection fails or is unexpectedly lost.
 *
 * @param message - Description of the connection failure.
 */
export class ConnectionError extends HRKitError {
  constructor(message: string, code: string = 'CONNECTION_ERROR') {
    super(message, code);
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when a scan or connection attempt exceeds the configured timeout.
 *
 * @param message - Description of the timeout.
 */
export class TimeoutError extends HRKitError {
  constructor(message: string, code: string = 'TIMEOUT_ERROR') {
    super(message, code);
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when no compatible BLE device is found during scan.
 *
 * @param message - Description of missing device.
 */
export class DeviceNotFoundError extends HRKitError {
  constructor(message: string, code: string = 'DEVICE_NOT_FOUND') {
    super(message, code);
    this.name = 'DeviceNotFoundError';
  }
}

/**
 * Thrown when validation fails. Includes detailed error and warning lists.
 *
 * @param message - Summary message.
 * @param errors - Array of specific error descriptions.
 * @param warnings - Array of warning descriptions.
 */
export class ValidationError extends HRKitError {
  readonly errors: string[];
  readonly warnings: string[];
  constructor(message: string, errors: string[] = [], warnings: string[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

// ── HTTP / API errors (used by @hrkit/integrations and friends) ────────

/**
 * Thrown when an HTTP request fails for a non-transient reason
 * (4xx that isn't 429/401/403, or unexpected response shape).
 */
export class RequestError extends HRKitError {
  /** HTTP status code, if available. */
  readonly status?: number;
  /** Server's request id, if surfaced via header (X-Request-Id, X-Amzn-RequestId, etc.). */
  readonly requestId?: string;
  /** Raw response body (truncated to 2 KB by the caller). */
  readonly responseBody?: string;
  constructor(
    message: string,
    options: { status?: number; requestId?: string; responseBody?: string; code?: string } = {},
  ) {
    super(message, options.code ?? 'REQUEST_ERROR');
    this.name = 'RequestError';
    this.status = options.status;
    this.requestId = options.requestId;
    this.responseBody = options.responseBody;
  }
}

/** 401/403 — authentication or authorization failure. */
export class AuthError extends RequestError {
  constructor(message: string, options: { status?: number; requestId?: string; responseBody?: string } = {}) {
    super(message, { ...options, code: 'AUTH_ERROR' });
    this.name = 'AuthError';
  }
}

/** 429 — rate limited. Carries `Retry-After` in seconds when known. */
export class RateLimitError extends RequestError {
  /** Seconds the caller should wait before retrying, parsed from `Retry-After`. */
  readonly retryAfterSeconds?: number;
  constructor(
    message: string,
    options: {
      status?: number;
      requestId?: string;
      responseBody?: string;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message, { ...options, code: 'RATE_LIMITED' });
    this.name = 'RateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** 5xx — upstream server reported an internal failure. */
export class ServerError extends RequestError {
  constructor(message: string, options: { status?: number; requestId?: string; responseBody?: string } = {}) {
    super(message, { ...options, code: 'SERVER_ERROR' });
    this.name = 'ServerError';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Heuristic: should this error be retried by {@link retry}? Defaults are
 * conservative — only network-y / transient failures qualify.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof ServerError) return true;
  if (err instanceof TimeoutError) return true;
  if (err instanceof AuthError) return false;
  if (err instanceof ValidationError) return false;
  if (err instanceof RequestError) {
    // 408 Request Timeout, 425 Too Early are transient.
    return err.status === 408 || err.status === 425;
  }
  // Unknown errors → assume transient (e.g. fetch network errors).
  return true;
}

/**
 * Format any error into a stable single-line string for logs. Includes
 * code, status, and request id when present.
 */
export function formatError(err: unknown): string {
  if (err instanceof HRKitError) {
    const parts: string[] = [`${err.name}: ${err.message}`];
    if (err.code) parts.push(`code=${err.code}`);
    if (err instanceof RequestError) {
      if (err.status !== undefined) parts.push(`status=${err.status}`);
      if (err.requestId) parts.push(`requestId=${err.requestId}`);
    }
    return parts.join(' ');
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
