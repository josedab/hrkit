import type { ArtifactFilterOptions, ArtifactFilterResult } from './types.js';

/**
 * Filter artifact RR intervals that deviate beyond a threshold from a local sliding mean.
 * Default threshold: 20%. Default window: 5 beats.
 *
 * @param rr - Array of RR intervals in milliseconds.
 * @param options - Optional filter configuration (threshold, strategy, windowSize).
 * @returns Filtered RR intervals and the proportion flagged as artifacts.
 *
 * @example
 * ```typescript
 * const { filtered, artifactRate } = filterArtifacts(rrIntervals, {
 *   threshold: 0.25,
 *   strategy: 'interpolate',
 * });
 * ```
 */
export function filterArtifacts(
  rr: number[],
  options?: ArtifactFilterOptions,
): ArtifactFilterResult {
  const threshold = options?.threshold ?? 0.2;
  const strategy = options?.strategy ?? 'remove';
  const windowSize = options?.windowSize ?? 5;

  if (rr.length === 0) {
    return { filtered: [], artifactRate: 0 };
  }

  if (rr.length === 1) {
    return { filtered: [...rr], artifactRate: 0 };
  }

  const halfWin = Math.floor(windowSize / 2);
  const isArtifact: boolean[] = new Array(rr.length).fill(false);
  let artifactCount = 0;

  for (let i = 0; i < rr.length; i++) {
    const start = Math.max(0, i - halfWin);
    const end = Math.min(rr.length - 1, i + halfWin);

    // Compute local mean excluding current sample
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      if (j !== i) {
        sum += rr[j]!;
        count++;
      }
    }

    if (count === 0) continue;

    const localMean = sum / count;
    const deviation = Math.abs(rr[i]! - localMean) / localMean;

    if (deviation > threshold) {
      isArtifact[i] = true;
      artifactCount++;
    }
  }

  const artifactRate = artifactCount / rr.length;

  if (strategy === 'remove') {
    const filtered = rr.filter((_, i) => !isArtifact[i]);
    return { filtered, artifactRate };
  }

  // Interpolate: replace artifact values with linearly interpolated values
  const filtered = [...rr];
  for (let i = 0; i < filtered.length; i++) {
    if (!isArtifact[i]) continue;

    // Find nearest clean beats before and after
    let prevClean = -1;
    let nextClean = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (!isArtifact[j]) { prevClean = j; break; }
    }
    for (let j = i + 1; j < filtered.length; j++) {
      if (!isArtifact[j]) { nextClean = j; break; }
    }

    if (prevClean >= 0 && nextClean >= 0) {
      const ratio = (i - prevClean) / (nextClean - prevClean);
      filtered[i] = filtered[prevClean]! + ratio * (filtered[nextClean]! - filtered[prevClean]!);
    } else if (prevClean >= 0) {
      filtered[i] = filtered[prevClean]!;
    } else if (nextClean >= 0) {
      filtered[i] = filtered[nextClean]!;
    }
    // If both are -1, leave original value (all artifacts edge case)
  }

  return { filtered, artifactRate };
}
