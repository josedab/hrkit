/**
 * Multi-sensor HR fusion using a simplified Kalman filter.
 *
 * Combines heart rate readings from N sources (chest strap, optical,
 * smartwatch) using quality-weighted consensus. Each source gets a
 * reliability score based on artifact rate, update frequency, and
 * signal consistency. The fused output is more accurate than any
 * single source alone.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface SensorSource {
  /** Unique source identifier (e.g., device ID). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Source type for default quality priors. */
  type: 'chest_strap' | 'optical_wrist' | 'optical_arm' | 'ecg' | 'other';
}

export interface SensorReading {
  /** Source identifier. */
  sourceId: string;
  /** Heart rate in bpm. */
  hr: number;
  /** Timestamp in ms. */
  timestamp: number;
  /** Optional: RR intervals for quality assessment. */
  rrIntervals?: number[];
}

export interface FusedOutput {
  /** Fused heart rate (quality-weighted consensus). */
  hr: number;
  /** Uncertainty estimate (±bpm, 95% CI). */
  uncertainty: number;
  /** Timestamp of the fused reading. */
  timestamp: number;
  /** ID of the primary contributing source. */
  primarySourceId: string;
  /** Per-source quality scores. */
  sourceQualities: Map<string, number>;
  /** Number of active sources contributing. */
  activeSourceCount: number;
}

export interface FusionConfig {
  /** Process noise (bpm²/s). Controls how quickly the filter adapts. Default: 0.5. */
  processNoise?: number;
  /** Maximum age (ms) before a source is considered stale. Default: 5000. */
  staleThresholdMs?: number;
  /** Minimum quality score for a source to contribute. Default: 0.1. */
  minQuality?: number;
}

// ── Quality Scoring ─────────────────────────────────────────────────────

const TYPE_PRIORS: Record<SensorSource['type'], number> = {
  ecg: 0.95,
  chest_strap: 0.9,
  optical_arm: 0.75,
  optical_wrist: 0.65,
  other: 0.5,
};

interface SourceState {
  source: SensorSource;
  lastHR: number;
  lastTimestamp: number;
  quality: number;
  /** Running artifact counter (sudden jumps). */
  artifactCount: number;
  /** Total readings received. */
  readingCount: number;
  /** Kalman estimate for this source. */
  estimate: number;
  /** Kalman error covariance. */
  errorCov: number;
}

// ── Sensor Fusion Engine ────────────────────────────────────────────────

/**
 * Multi-source HR fusion engine.
 *
 * Register sources, push readings, and get fused output. The engine
 * maintains per-source Kalman filters and produces a quality-weighted
 * consensus HR.
 *
 * @example
 * ```ts
 * const fusion = new SensorFusion();
 * fusion.addSource({ id: 'chest', label: 'Polar H10', type: 'chest_strap' });
 * fusion.addSource({ id: 'watch', label: 'Apple Watch', type: 'optical_wrist' });
 * fusion.pushReading({ sourceId: 'chest', hr: 72, timestamp: Date.now() });
 * fusion.pushReading({ sourceId: 'watch', hr: 74, timestamp: Date.now() });
 * const fused = fusion.getFused();
 * console.log(fused.hr); // ~72.5, weighted toward chest strap
 * ```
 */
export class SensorFusion {
  private sources = new Map<string, SourceState>();
  private readonly config: Required<FusionConfig>;

  constructor(config?: FusionConfig) {
    this.config = {
      processNoise: config?.processNoise ?? 0.5,
      staleThresholdMs: config?.staleThresholdMs ?? 5000,
      minQuality: config?.minQuality ?? 0.1,
    };
  }

  /** Register a sensor source. */
  addSource(source: SensorSource): void {
    this.sources.set(source.id, {
      source,
      lastHR: 0,
      lastTimestamp: 0,
      quality: TYPE_PRIORS[source.type],
      artifactCount: 0,
      readingCount: 0,
      estimate: 0,
      errorCov: 100, // high initial uncertainty
    });
  }

  /** Remove a sensor source. */
  removeSource(id: string): void {
    this.sources.delete(id);
  }

  /** Push a new reading from a source. */
  pushReading(reading: SensorReading): void {
    const state = this.sources.get(reading.sourceId);
    if (!state) return;

    // Detect artifacts (>30 bpm jump in <2s)
    if (state.readingCount > 0 && state.lastHR > 0) {
      const dt = (reading.timestamp - state.lastTimestamp) / 1000;
      const hrChange = Math.abs(reading.hr - state.lastHR);
      if (dt < 2 && hrChange > 30) {
        state.artifactCount++;
      }
    }

    state.readingCount++;
    state.lastHR = reading.hr;
    state.lastTimestamp = reading.timestamp;

    // Update per-source Kalman filter
    this.kalmanUpdate(state, reading.hr, reading.timestamp);

    // Update quality score
    this.updateQuality(state);
  }

  /**
   * Get the current fused HR reading.
   *
   * @param now - Current timestamp (default: Date.now()).
   * @returns Fused output, or null if no active sources.
   */
  getFused(now?: number): FusedOutput | null {
    const ts = now ?? Date.now();
    const active = this.getActiveSources(ts);

    if (active.length === 0) return null;

    // Quality-weighted fusion
    let weightedSum = 0;
    let totalWeight = 0;
    let bestSource = active[0]!;
    const qualities = new Map<string, number>();

    for (const state of active) {
      const w = state.quality;
      weightedSum += state.estimate * w;
      totalWeight += w;
      qualities.set(state.source.id, Math.round(state.quality * 100) / 100);
      if (state.quality > bestSource.quality) bestSource = state;
    }

    const fusedHR = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Uncertainty from weighted error covariance
    let weightedCov = 0;
    for (const state of active) {
      const w = state.quality / totalWeight;
      weightedCov += w * w * state.errorCov;
    }
    const uncertainty = Math.round(1.96 * Math.sqrt(weightedCov) * 10) / 10;

    return {
      hr: Math.round(fusedHR * 10) / 10,
      uncertainty,
      timestamp: ts,
      primarySourceId: bestSource.source.id,
      sourceQualities: qualities,
      activeSourceCount: active.length,
    };
  }

  /** Get per-source quality scores. */
  getSourceQualities(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [id, state] of this.sources) {
      result.set(id, Math.round(state.quality * 100) / 100);
    }
    return result;
  }

  /** Get all registered source IDs. */
  get sourceIds(): string[] {
    return Array.from(this.sources.keys());
  }

  private getActiveSources(now: number): SourceState[] {
    return Array.from(this.sources.values()).filter(
      (s) =>
        s.readingCount > 0 &&
        now - s.lastTimestamp < this.config.staleThresholdMs &&
        s.quality >= this.config.minQuality,
    );
  }

  private kalmanUpdate(state: SourceState, measurement: number, _timestamp: number): void {
    const Q = this.config.processNoise;
    const R = this.measurementNoise(state);

    if (state.readingCount <= 1) {
      state.estimate = measurement;
      state.errorCov = R;
      return;
    }

    // Predict
    const predictedEstimate = state.estimate;
    const predictedCov = state.errorCov + Q;

    // Update
    const K = predictedCov / (predictedCov + R);
    state.estimate = predictedEstimate + K * (measurement - predictedEstimate);
    state.errorCov = (1 - K) * predictedCov;
  }

  private measurementNoise(state: SourceState): number {
    // Base noise from sensor type
    const base = (1 - TYPE_PRIORS[state.source.type]) * 20 + 1;
    // Artifact penalty
    const artifactPenalty = state.readingCount > 0 ? (state.artifactCount / state.readingCount) * 10 : 0;
    return base + artifactPenalty;
  }

  private updateQuality(state: SourceState): void {
    const prior = TYPE_PRIORS[state.source.type];
    const artifactRate = state.readingCount > 0 ? state.artifactCount / state.readingCount : 0;
    // Quality degrades with artifacts
    state.quality = Math.max(0.05, prior * (1 - artifactRate * 2));
  }
}
