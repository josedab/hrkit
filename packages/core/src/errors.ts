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
