import { DEFAULT_ARTIFACT_DEVIATION, DEFAULT_ARTIFACT_WINDOW } from './constants.js';
import { SimpleStream } from './stream.js';
import type { ReadableStream } from './types.js';

/** A real-time artifact event emitted for each RR interval. */
export interface ArtifactEvent {
  /** Timestamp of the RR interval. */
  timestamp: number;
  /** The RR interval value in ms. */
  rr: number;
  /** Relative deviation from local mean (0–1+). */
  deviation: number;
  /** Whether this interval is flagged as an artifact. */
  isArtifact: boolean;
}

/**
 * Real-time artifact detector that flags RR intervals as they arrive.
 * Uses a sliding window to compute a local mean and flags intervals
 * that deviate beyond the threshold.
 */
export class RealtimeArtifactDetector {
  private buffer: number[] = [];
  private windowSize: number;
  private threshold: number;
  private stream = new SimpleStream<ArtifactEvent>();

  /** Observable stream of artifact events. */
  readonly artifacts$: ReadableStream<ArtifactEvent> = this.stream;

  /**
   * @param windowSize - Number of RR intervals in the sliding window. Default: 5.
   * @param threshold - Deviation threshold (fraction). Default: 0.2 (20%).
   */
  constructor(windowSize: number = DEFAULT_ARTIFACT_WINDOW, threshold: number = DEFAULT_ARTIFACT_DEVIATION) {
    this.windowSize = windowSize;
    this.threshold = threshold;
  }

  /**
   * Ingest an RR interval and emit an artifact event.
   *
   * @param rr - RR interval value in milliseconds.
   * @param timestamp - Timestamp of this RR interval in ms.
   */
  ingest(rr: number, timestamp: number): void {
    this.buffer.push(rr);

    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    // Need at least 3 samples to detect artifacts
    if (this.buffer.length < 3) {
      this.stream.emit({ timestamp, rr, deviation: 0, isArtifact: false });
      return;
    }

    const idx = this.buffer.length - 1;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      if (i !== idx) {
        sum += this.buffer[i]!;
        count++;
      }
    }

    const localMean = sum / count;
    if (localMean <= 0 || !Number.isFinite(localMean)) {
      this.stream.emit({
        timestamp,
        rr,
        deviation: 0,
        isArtifact: true,
      });
      return;
    }
    const deviation = Math.abs(rr - localMean) / localMean;
    const isArtifact = deviation > this.threshold;

    this.stream.emit({
      timestamp,
      rr,
      deviation: Math.round(deviation * 10000) / 10000,
      isArtifact,
    });
  }

  /** Reset the internal buffer. */
  reset(): void {
    this.buffer = [];
  }
}
