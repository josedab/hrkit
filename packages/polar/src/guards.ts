import type { HRConnection } from '@hrkit/core';
import { POLAR_PMD_SERVICE_UUID } from '@hrkit/core';
import type { PolarConnection } from './types.js';

/**
 * Type guard to check if an HRConnection is a PolarConnection.
 */
export function isPolarConnection(conn: HRConnection): conn is PolarConnection {
  return conn.profile.serviceUUIDs.includes(POLAR_PMD_SERVICE_UUID);
}
