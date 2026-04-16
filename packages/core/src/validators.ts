import type { HRPacket } from './types.js';

/** Result of validating an HR packet. */
export interface ValidationResult {
  /** Whether the packet passes all validation checks. */
  valid: boolean;
  /** List of validation warnings (non-empty if valid is false). */
  warnings: string[];
}

/** Configuration for HR packet validation. */
export interface ValidationConfig {
  /** Acceptable HR range in bpm. Default: [30, 250]. */
  hrRange?: [min: number, max: number];
  /** Acceptable RR interval range in ms. Default: [200, 2000]. */
  rrRange?: [min: number, max: number];
}

const DEFAULT_HR_RANGE: [number, number] = [30, 250];
const DEFAULT_RR_RANGE: [number, number] = [200, 2000];

/**
 * Validate an HR packet against physiological ranges.
 * Returns warnings for out-of-range values without modifying the data.
 */
export function validateHRPacket(
  packet: HRPacket,
  config: ValidationConfig = {},
): ValidationResult {
  const hrRange = config.hrRange ?? DEFAULT_HR_RANGE;
  const rrRange = config.rrRange ?? DEFAULT_RR_RANGE;
  const warnings: string[] = [];

  if (packet.hr < hrRange[0] || packet.hr > hrRange[1]) {
    warnings.push(`HR ${packet.hr} bpm outside range [${hrRange[0]}, ${hrRange[1]}]`);
  }

  for (const rr of packet.rrIntervals) {
    if (rr < rrRange[0] || rr > rrRange[1]) {
      warnings.push(`RR ${rr.toFixed(1)}ms outside range [${rrRange[0]}, ${rrRange[1]}]`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}
