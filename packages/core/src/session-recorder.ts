import type {
  HRPacket,
  TimestampedHR,
  SessionConfig,
  Session,
  Round,
  RoundMeta,
  HRZoneConfig,
  ReadableStream,
  DeviceProfile,
} from './types.js';
import { SESSION_SCHEMA_VERSION } from './types.js';
import { hrToZone } from './zones.js';
import { HRKitError } from './errors.js';
import { SimpleStream } from './stream.js';

type Zone = 1 | 2 | 3 | 4 | 5;

/**
 * Stateful session recorder that ingests HRPacket events and builds a Session.
 *
 * Supports round-based tracking for interval training (e.g., BJJ rounds,
 * HIIT intervals). Provides real-time observable streams for HR and zone.
 * Supports pause/resume for interruptions without data loss.
 *
 * @example
 * ```typescript
 * const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });
 * recorder.hr$.subscribe((hr) => console.log('HR:', hr));
 *
 * for await (const packet of conn.heartRate()) {
 *   recorder.ingest(packet);
 * }
 *
 * const session = recorder.end();
 * ```
 */
export class SessionRecorder {
  private config: SessionConfig;
  private zoneConfig: HRZoneConfig;
  private startTime: number | null = null;
  private lastPacketTime: number | null = null;
  private samples: TimestampedHR[] = [];
  private rrIntervals: number[] = [];
  private rounds: Round[] = [];
  private currentRound: {
    startTime: number;
    samples: TimestampedHR[];
    rrIntervals: number[];
    meta?: RoundMeta;
  } | null = null;
  private _paused = false;

  private hrStream = new SimpleStream<number>();
  private zoneStream = new SimpleStream<Zone>();

  private _deviceInfo?: { id: string; name: string; profile?: DeviceProfile };
  private _metadata?: Record<string, unknown>;

  /** Observable stream of heart rate values. Emits current value on subscribe. */
  readonly hr$: ReadableStream<number> = this.hrStream;
  /** Observable stream of zone values (1–5). Emits current value on subscribe. */
  readonly zone$: ReadableStream<Zone> = this.zoneStream;

  constructor(config: SessionConfig) {
    this.config = config;
    this.zoneConfig = {
      maxHR: config.maxHR,
      restHR: config.restHR,
      zones: config.zones ?? [0.6, 0.7, 0.8, 0.9],
    };
  }

  /**
   * Set device info to be included in the session output.
   *
   * @param info - Device identifier, name, and optional profile.
   */
  setDeviceInfo(info: { id: string; name: string; profile?: DeviceProfile }): void {
    this._deviceInfo = info;
  }

  /**
   * Set arbitrary metadata to be included in the session output.
   *
   * @param metadata - Key-value pairs (e.g., activity type, athlete info).
   */
  setMetadata(metadata: Record<string, unknown>): void {
    this._metadata = metadata;
  }

  /**
   * Feed an HR packet into the session. Updates samples, RR intervals, and streams.
   * Ignored when paused. Silently skips backward timestamps and physiologically invalid HR (< 0 or > 300 bpm).
   *
   * @param packet - Parsed HR packet from BLE or mock transport.
   */
  ingest(packet: HRPacket): void {
    if (this._paused) return;

    // Validate timestamp monotonicity (skip backward timestamps)
    if (this.lastPacketTime !== null && packet.timestamp < this.lastPacketTime) {
      return;
    }

    // Validate HR is in physiological range (skip obviously bad data)
    if (packet.hr < 0 || packet.hr > 300) {
      return;
    }

    if (this.startTime === null) {
      this.startTime = packet.timestamp;
    }
    this.lastPacketTime = packet.timestamp;

    const sample: TimestampedHR = { timestamp: packet.timestamp, hr: packet.hr };
    this.samples.push(sample);
    this.rrIntervals.push(...packet.rrIntervals);

    if (this.currentRound) {
      this.currentRound.samples.push(sample);
      this.currentRound.rrIntervals.push(...packet.rrIntervals);
    }

    this.hrStream.emit(packet.hr);
    this.zoneStream.emit(hrToZone(packet.hr, this.zoneConfig));
  }

  /**
   * Begin a new round. Subsequent ingested packets are recorded to this round.
   *
   * @param meta - Optional round metadata (label, custom key-value pairs).
   * @throws {HRKitError} if a round is already in progress.
   */
  startRound(meta?: RoundMeta): void {
    if (this.currentRound) {
      throw new HRKitError('Cannot start a new round while one is already in progress. Call endRound() first.');
    }
    this.currentRound = {
      startTime: this.lastPacketTime ?? this.startTime ?? 0,
      samples: [],
      rrIntervals: [],
      meta,
    };
  }

  /**
   * End the current round and return its data.
   *
   * @param meta - Optional metadata to override the meta set at `startRound()`.
   * @returns The completed {@link Round} with samples, RR intervals, and timing.
   * @throws {HRKitError} if no round is in progress.
   */
  endRound(meta?: RoundMeta): Round {
    if (!this.currentRound) {
      throw new HRKitError('No round in progress');
    }

    const round: Round = {
      index: this.rounds.length,
      startTime: this.currentRound.startTime,
      endTime: this.lastPacketTime ?? this.currentRound.startTime,
      samples: [...this.currentRound.samples],
      rrIntervals: [...this.currentRound.rrIntervals],
      meta: meta ?? this.currentRound.meta,
    };

    this.rounds.push(round);
    this.currentRound = null;
    return round;
  }

  /** Pause recording. Ingested packets are ignored until `resume()` is called. */
  pause(): void {
    this._paused = true;
  }

  /** Resume recording after a pause. */
  resume(): void {
    this._paused = false;
  }

  /** Whether the recorder is currently paused. */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Latest ingested heart rate, or `null` if no data yet.
   *
   * @returns Current HR in bpm, or `null` before the first packet.
   */
  currentHR(): number | null {
    return this.hrStream.get() ?? null;
  }

  /**
   * Latest computed HR zone (1–5), or `null` if no data yet.
   *
   * @returns Current zone (1–5), or `null` before the first packet.
   */
  currentZone(): Zone | null {
    return this.zoneStream.get() ?? null;
  }

  /**
   * Seconds elapsed since the first ingested packet (based on packet timestamps).
   *
   * @returns Elapsed time in seconds, or 0 if no packets have been ingested.
   */
  elapsedSeconds(): number {
    if (this.startTime === null || this.lastPacketTime === null) return 0;
    return (this.lastPacketTime - this.startTime) / 1000;
  }

  /**
   * Finalize the session and return the complete Session object.
   * Auto-closes any open round. Returns a deep snapshot safe from later mutation.
   *
   * @returns The completed {@link Session} with all samples, RR intervals, rounds, and config.
   */
  end(): Session {
    // Auto-close open round
    if (this.currentRound) {
      this.endRound();
    }

    const now = this.lastPacketTime ?? 0;
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startTime: this.startTime ?? now,
      endTime: now,
      samples: [...this.samples],
      rrIntervals: [...this.rrIntervals],
      rounds: this.rounds.map((r) => ({
        ...r,
        samples: [...r.samples],
        rrIntervals: [...r.rrIntervals],
      })),
      config: { ...this.config },
      deviceInfo: this._deviceInfo ? { ...this._deviceInfo } : undefined,
      metadata: this._metadata ? { ...this._metadata } : undefined,
    };
  }
}
