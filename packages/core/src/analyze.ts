import type {
  Session,
  TRIMPConfig,
  HRZoneConfig,
  ZoneDistribution,
  ArtifactFilterResult,
} from './types.js';
import { rmssd, sdnn, pnn50, meanHR } from './hrv.js';
import { zoneDistribution } from './zones.js';
import { trimp } from './trimp.js';
import { filterArtifacts } from './artifact-filter.js';

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
  const durationSec = samples.length >= 2
    ? (samples[samples.length - 1]!.timestamp - samples[0]!.timestamp) / 1000
    : 0;

  // HR statistics from samples
  const hrs = samples.map((s) => s.hr);
  const hrMin = hrs.length > 0 ? Math.min(...hrs) : 0;
  const hrMax = hrs.length > 0 ? Math.max(...hrs) : 0;
  const hrMean = hrs.length > 0 ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0;

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
