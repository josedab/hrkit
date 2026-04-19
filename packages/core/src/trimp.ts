import { SEX_FACTORS } from './constants.js';
import type { Session, TimestampedHR, TRIMPConfig } from './types.js';

/**
 * Bannister's TRIMP (Training Impulse).
 * TRIMP = Σ (duration_min × HRR × 0.64 × e^(sexFactor × HRR))
 * where HRR = (HR - restHR) / (maxHR - restHR)
 *
 * @param samples - Timestamped HR samples.
 * @param config - TRIMP configuration with maxHR, restHR, sex.
 * @returns TRIMP value. Returns 0 if fewer than 2 samples.
 *
 * @example
 * ```ts
 * const load = trimp(session.samples, { maxHR: 185, restHR: 55, sex: 'male' });
 * console.log(`Training load: ${load.toFixed(1)}`);
 * ```
 */
export function trimp(samples: TimestampedHR[], config: TRIMPConfig): number {
  if (samples.length < 2) return 0;
  if (config.maxHR <= config.restHR) return 0;

  const hrRange = config.maxHR - config.restHR;
  const sexFactor = SEX_FACTORS[config.sex];
  let total = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const current = samples[i]!;
    const next = samples[i + 1]!;
    const durationMin = (next.timestamp - current.timestamp) / 60000;

    if (durationMin <= 0 || durationMin > 0.5) continue; // skip gaps > 30s

    const hrr = Math.max(0, Math.min(1, (current.hr - config.restHR) / hrRange));
    total += durationMin * hrr * 0.64 * Math.exp(sexFactor * hrr);
  }

  return total;
}

/**
 * Aggregate weekly TRIMP from a set of sessions.
 * Uses the sex from each session's config, falling back to the provided default or 'neutral'.
 *
 * @param sessions - Array of sessions to aggregate.
 * @param weekStart - Start of the week (Date).
 * @param defaultSex - Default sex for TRIMP if session doesn't specify.
 * @returns Sum of TRIMP for sessions within the week.
 */
export function weeklyTRIMP(sessions: Session[], weekStart: Date, defaultSex: TRIMPConfig['sex'] = 'neutral'): number {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

  return sessions
    .filter((s) => s.startTime >= weekStartMs && s.startTime < weekEndMs)
    .reduce((sum, session) => {
      const config: TRIMPConfig = {
        maxHR: session.config.maxHR,
        restHR: session.config.restHR ?? 60,
        sex: session.config.sex ?? defaultSex,
      };
      return sum + trimp(session.samples, config);
    }, 0);
}
