/**
 * @hrkit/core/testing — test utilities and conformance helpers.
 *
 * Separates test-oriented exports (fixture builders, hex converters,
 * conformance verification) from the main `@hrkit/core` entry point
 * so they don't pollute autocomplete for production code.
 *
 * @example
 * ```ts
 * import { MockTransport, verifyFixture, hexToDataView } from '@hrkit/core/testing';
 * ```
 *
 * @packageDocumentation
 */

// Conformance utilities
export type { ConformanceFixture, ConformanceResult, RecordedNotification } from '../conformance.js';
export {
  bytesToHex,
  CONFORMANCE_FIXTURE_SCHEMA,
  hexToDataView,
  recordNotification,
  verifyFixture,
} from '../conformance.js';

// Mock transport for testing
export type { MockFixture } from '../mock-transport.js';
export { MockTransport } from '../mock-transport.js';
