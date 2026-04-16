import type { HRPacket, HRZoneConfig, Session, SessionConfig } from './types.js';

/** Result of validating an HR packet. */
export interface ValidationResult {
  /** Whether the packet passes all validation checks. */
  valid: boolean;
  /** List of validation warnings (non-empty if valid is false). */
  warnings: string[];
  /** List of validation errors. */
  errors: string[];
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
export function validateHRPacket(packet: HRPacket, config: ValidationConfig = {}): ValidationResult {
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

  return { valid: warnings.length === 0, warnings, errors: [] };
}

/**
 * Validate zone configuration thresholds.
 *
 * @param config - HR zone configuration to validate.
 * @returns {@link ValidationResult} with errors for invalid thresholds.
 */
export function validateZoneConfig(config: HRZoneConfig): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (config.maxHR <= 0) errors.push('maxHR must be positive');
  if (config.restHR !== undefined && config.restHR < 0) errors.push('restHR must be non-negative');
  if (config.restHR !== undefined && config.restHR >= config.maxHR) errors.push('restHR must be less than maxHR');

  const z = config.zones;
  for (let i = 0; i < 4; i++) {
    if (z[i]! < 0 || z[i]! > 1) errors.push(`Zone threshold ${i} must be between 0 and 1`);
  }
  if (z[0] >= z[1] || z[1] >= z[2] || z[2] >= z[3]) {
    errors.push('Zone thresholds must be in strictly ascending order');
  }

  return { valid: errors.length === 0, warnings, errors };
}

/**
 * Validate a session config.
 *
 * @param config - Session configuration to validate.
 * @returns {@link ValidationResult} with errors for invalid values.
 */
export function validateSessionConfig(config: SessionConfig): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (config.maxHR <= 0) errors.push('maxHR must be positive');
  if (config.restHR !== undefined && config.restHR < 0) errors.push('restHR must be non-negative');
  if (config.restHR !== undefined && config.restHR >= config.maxHR) errors.push('restHR must be less than maxHR');
  if (config.zones) {
    const zoneResult = validateZoneConfig({ maxHR: config.maxHR, restHR: config.restHR, zones: config.zones });
    errors.push(...zoneResult.errors);
    warnings.push(...zoneResult.warnings);
  }

  return { valid: errors.length === 0, warnings, errors };
}

/**
 * Validate a complete session for structural integrity.
 *
 * @param session - The session to validate.
 * @returns {@link ValidationResult} with errors and warnings for structural issues.
 */
export function validateSession(session: Session): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (session.endTime < session.startTime) errors.push('endTime must be >= startTime');
  if (session.samples.length === 0) warnings.push('Session has no samples');

  // Check sample timestamp ordering
  for (let i = 1; i < session.samples.length; i++) {
    if (session.samples[i]!.timestamp < session.samples[i - 1]!.timestamp) {
      errors.push(`Sample ${i} has timestamp before sample ${i - 1}`);
      break;
    }
  }

  // Validate rounds
  for (const round of session.rounds) {
    if (round.endTime < round.startTime) {
      errors.push(`Round ${round.index} has endTime before startTime`);
    }
  }

  // Validate config
  const configResult = validateSessionConfig(session.config);
  errors.push(...configResult.errors);
  warnings.push(...configResult.warnings);

  return { valid: errors.length === 0, warnings, errors };
}
