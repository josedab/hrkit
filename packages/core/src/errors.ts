/**
 * Custom error hierarchy for @hrkit/core.
 * Provides structured, catchable error types for BLE parsing,
 * connection management, and device discovery failures.
 */

/** Base error for all @hrkit errors. */
export class HRKitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HRKitError';
  }
}

/** Thrown when BLE data cannot be parsed (truncated buffer, invalid format). */
export class ParseError extends HRKitError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/** Thrown when a BLE connection fails or is unexpectedly lost. */
export class ConnectionError extends HRKitError {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/** Thrown when a scan or connection attempt exceeds the configured timeout. */
export class TimeoutError extends HRKitError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Thrown when no compatible BLE device is found during scan. */
export class DeviceNotFoundError extends HRKitError {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceNotFoundError';
  }
}
