import { SEX_FACTORS } from './constants.js';
import { rmssd as computeRmssd } from './hrv.js';
import { SimpleStream } from './stream.js';
import type { ReadableStream, TRIMPConfig } from './types.js';

// ── Rolling RMSSD ───────────────────────────────────────────────────────

/** A windowed RMSSD measurement. */
export interface WindowedHRV {
  /** RMSSD value for this window. */
  rmssd: number;
  /** Timestamp of the latest RR interval in this window. */
  timestamp: number;
  /** Number of RR intervals in this window. */
  sampleCount: number;
}

/**
 * Rolling RMSSD calculator that emits windowed HRV measurements.
 * Maintains a sliding buffer of RR intervals and emits RMSSD
 * each time new data arrives (once minimum samples are met).
 *
 * @example
 * ```ts
 * const rolling = new RollingRMSSD(30, 5);
 * rolling.rmssd$.subscribe(({ rmssd, timestamp }) => {
 *   console.log(`rMSSD: ${rmssd.toFixed(1)}ms at ${timestamp}`);
 * });
 * rolling.ingest(packet.rrIntervals, packet.timestamp);
 * ```
 */
export class RollingRMSSD {
  private buffer: number[] = [];
  private windowSize: number;
  private minSamples: number;
  private stream = new SimpleStream<WindowedHRV>();

  /** Observable stream of windowed RMSSD values. */
  readonly rmssd$: ReadableStream<WindowedHRV> = this.stream;

  /**
   * @param windowSize - Maximum number of RR intervals in the window. Default: 30.
   * @param minSamples - Minimum samples before emitting. Default: 5.
   */
  constructor(windowSize: number = 30, minSamples: number = 5) {
    this.windowSize = windowSize;
    this.minSamples = minSamples;
  }

  /**
   * Ingest one or more RR intervals. Emits updated RMSSD if window has enough data.
   *
   * @param rrIntervals - Array of RR intervals in milliseconds.
   * @param timestamp - Timestamp for this batch of intervals.
   */
  ingest(rrIntervals: number[], timestamp: number): void {
    this.buffer.push(...rrIntervals);

    // Trim to window size
    if (this.buffer.length > this.windowSize) {
      this.buffer = this.buffer.slice(-this.windowSize);
    }

    if (this.buffer.length >= this.minSamples) {
      this.stream.emit({
        rmssd: computeRmssd(this.buffer),
        timestamp,
        sampleCount: this.buffer.length,
      });
    }
  }

  /** Reset the internal buffer. */
  reset(): void {
    this.buffer = [];
  }
}

// ── TRIMP Accumulator ───────────────────────────────────────────────────

/** A cumulative TRIMP measurement. */
export interface CumulativeTRIMP {
  /** Accumulated TRIMP value. */
  trimp: number;
  /** Timestamp of the latest sample. */
  timestamp: number;
}

/**
 * Live TRIMP accumulator that emits cumulative TRIMP as HR data arrives.
 * Uses Bannister's formula incrementally per sample.
 *
 * @example
 * ```ts
 * const acc = new TRIMPAccumulator({ maxHR: 190, restHR: 55, sex: 'male' });
 * acc.trimp$.subscribe(({ trimp }) => console.log(`TRIMP: ${trimp.toFixed(1)}`));
 * acc.ingest(packet.hr, packet.timestamp);
 * ```
 */
export class TRIMPAccumulator {
  private config: TRIMPConfig;
  private cumulative = 0;
  private lastTimestamp: number | null = null;
  private stream = new SimpleStream<CumulativeTRIMP>();

  /** Observable stream of cumulative TRIMP values. */
  readonly trimp$: ReadableStream<CumulativeTRIMP> = this.stream;

  /**
   * @param config - TRIMP calculation parameters (maxHR, restHR, sex).
   */
  constructor(config: TRIMPConfig) {
    this.config = config;
  }

  /**
   * Ingest an HR sample and accumulate TRIMP. Skips gaps > 30s.
   *
   * @param hr - Heart rate in BPM.
   * @param timestamp - Sample timestamp in ms.
   */
  ingest(hr: number, timestamp: number): void {
    if (this.lastTimestamp !== null) {
      const durationMin = (timestamp - this.lastTimestamp) / 60000;

      // Skip gaps > 30s and negative durations
      if (durationMin > 0 && durationMin <= 0.5) {
        const hrRange = this.config.maxHR - this.config.restHR;
        if (hrRange > 0) {
          const hrr = Math.max(0, Math.min(1, (hr - this.config.restHR) / hrRange));
          const sexFactor = SEX_FACTORS[this.config.sex];
          this.cumulative += durationMin * hrr * 0.64 * Math.exp(sexFactor * hrr);
        }
      }
    }

    this.lastTimestamp = timestamp;
    this.stream.emit({
      trimp: Math.round(this.cumulative * 100) / 100,
      timestamp,
    });
  }

  /** Reset accumulated TRIMP to zero. */
  reset(): void {
    this.cumulative = 0;
    this.lastTimestamp = null;
  }
}
