import { filterArtifacts } from './artifact-filter.js';
import { meanHR, pnn50, rmssd, sdnn } from './hrv.js';
import { trimp } from './trimp.js';
import type { ArtifactFilterResult, HRZoneConfig, Session, TRIMPConfig, ZoneDistribution } from './types.js';
import { zoneDistribution } from './zones.js';

/** Complete post-session analysis result. */
export interface SessionAnalysis {
  /** Duration in seconds (based on sample timestamps). */
  durationSec: number;
  /** Total number of HR samples. */
  sampleCount: number;
  /** Total number of RR intervals. */
  rrCount: number;
  /** Number of rounds recorded. */
  roundCount: number;

  /** Heart rate statistics. */
  hr: {
    mean: number;
    min: number;
    max: number;
    /** Mean HR derived from RR intervals (more accurate). Null if no RR data. */
    meanFromRR: number | null;
  };

  /** HRV metrics (computed from filtered RR intervals). Null if no RR data. */
  hrv: {
    rmssd: number;
    sdnn: number;
    pnn50: number;
  } | null;

  /** Artifact filtering results. Null if no RR data. */
  artifacts: ArtifactFilterResult | null;

  /** Zone distribution. */
  zones: ZoneDistribution;

  /** Bannister's TRIMP. */
  trimp: number;
}

/**
 * One-call post-session analysis: HRV, TRIMP, zones, artifact filtering.
 * Computes all common metrics from a Session in a single function call.
 *
 * @param session - The completed session to analyze.
 * @returns Complete analysis including HR stats, HRV, zones, TRIMP, and artifacts.
 *
 * @example
 * ```typescript
 * const session = recorder.end();
 * const analysis = analyzeSession(session);
 * console.log(`TRIMP: ${analysis.trimp}, RMSSD: ${analysis.hrv?.rmssd}`);
 * ```
 */
export function analyzeSession(session: Session): SessionAnalysis {
  const { samples, rrIntervals, config } = session;

  // Duration
  const rawDuration = samples.length >= 2 ? (samples[samples.length - 1]!.timestamp - samples[0]!.timestamp) / 1000 : 0;
  const durationSec = Number.isFinite(rawDuration) ? rawDuration : 0;

  // HR statistics from samples — use single-pass reduce to avoid spread-arg
  // RangeError on long sessions (e.g. 4Hz × multi-hour can exceed V8 spread limit).
  let hrMin = 0;
  let hrMax = 0;
  let hrSum = 0;
  if (samples.length > 0) {
    hrMin = Number.POSITIVE_INFINITY;
    hrMax = Number.NEGATIVE_INFINITY;
    for (const s of samples) {
      if (s.hr < hrMin) hrMin = s.hr;
      if (s.hr > hrMax) hrMax = s.hr;
      hrSum += s.hr;
    }
  }
  const hrMean = samples.length > 0 ? hrSum / samples.length : 0;

  // HRV + artifacts (only if RR data available)
  let hrvResult: SessionAnalysis['hrv'] = null;
  let artifactResult: SessionAnalysis['artifacts'] = null;
  let meanFromRR: number | null = null;

  if (rrIntervals.length >= 2) {
    artifactResult = filterArtifacts(rrIntervals);
    const cleanRR = artifactResult.filtered;

    hrvResult = {
      rmssd: rmssd(cleanRR),
      sdnn: sdnn(cleanRR),
      pnn50: pnn50(cleanRR),
    };

    meanFromRR = meanHR(cleanRR);
  }

  // Zone config
  const zoneConfig: HRZoneConfig = {
    maxHR: config.maxHR,
    restHR: config.restHR,
    zones: config.zones ?? [0.6, 0.7, 0.8, 0.9],
  };

  // TRIMP config
  const trimpConfig: TRIMPConfig = {
    maxHR: config.maxHR,
    restHR: config.restHR ?? 60,
    sex: config.sex ?? 'neutral',
  };

  return {
    durationSec,
    sampleCount: samples.length,
    rrCount: rrIntervals.length,
    roundCount: session.rounds.length,
    hr: {
      mean: Math.round(hrMean * 10) / 10,
      min: hrMin,
      max: hrMax,
      meanFromRR,
    },
    hrv: hrvResult,
    artifacts: artifactResult,
    zones: zoneDistribution(samples, zoneConfig),
    trimp: trimp(samples, trimpConfig),
  };
}
