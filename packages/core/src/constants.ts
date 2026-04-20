import type { TRIMPConfig } from './types.js';

/**
 * Sex-based exponential weighting factors for Bannister's TRIMP.
 *
 * Source: Banister, E. W., Calvert, T. W. (1980). "Planning for future performance:
 * implications for long term training." Canadian Journal of Applied Sport Sciences 5(3):170-176.
 *
 * Used by both batch (`trimp`) and incremental (`TRIMPAccumulator`) calculators —
 * both must read from this single source.
 */
export const SEX_FACTORS: Record<TRIMPConfig['sex'], number> = {
  male: 1.92,
  female: 1.67,
  neutral: 1.8,
};

/**
 * Default RR-interval artifact deviation threshold (fraction of local mean).
 *
 * An RR interval that deviates from its sliding-window neighbors by more than
 * this fraction is flagged as an artifact. 0.2 (20%) is a widely cited default
 * (e.g., Tarvainen et al., HRV-Analysis Toolkit).
 *
 * Used by `filterArtifacts`, `RealtimeArtifactDetector`, and `MultiDeviceManager`'s
 * cross-device sanity check — all must read from this single source.
 */
export const DEFAULT_ARTIFACT_DEVIATION = 0.2;

/**
 * Default sliding window size (in beats) for artifact detection.
 *
 * Used by `filterArtifacts` and `RealtimeArtifactDetector`.
 */
export const DEFAULT_ARTIFACT_WINDOW = 5;
