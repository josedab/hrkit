import type {
  HRPacket,
  TimestampedHR,
  SessionConfig,
  Session,
  Round,
  RoundMeta,
  HRZoneConfig,
  ReadableStream,
  Unsubscribe,
  DeviceProfile,
} from './types.js';
import { SESSION_SCHEMA_VERSION } from './types.js';
import { hrToZone } from './zones.js';

type Zone = 1 | 2 | 3 | 4 | 5;

/**
 * Minimal observable stream with BehaviorSubject-like semantics.
 * Emits the current value to new subscribers immediately on subscribe.
 */
class SimpleStream<T> implements ReadableStream<T> {
  private listeners = new Set<(value: T) => void>();
  private current: T | undefined;

  subscribe(listener: (value: T) => void): Unsubscribe {
    this.listeners.add(listener);
    // Emit current value on subscribe (BehaviorSubject semantics)
    if (this.current !== undefined) {
      listener(this.current);
    }
    return () => this.listeners.delete(listener);
  }

  get(): T | undefined {
    return this.current;
  }

  emit(value: T): void {
    this.current = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}

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

  /** Set device info to be included in the session output. */
  setDeviceInfo(info: { id: string; name: string; profile?: DeviceProfile }): void {
    this._deviceInfo = info;
  }

  /** Set arbitrary metadata to be included in the session output. */
  setMetadata(metadata: Record<string, unknown>): void {
    this._metadata = metadata;
  }

  /** Feed an HR packet into the session. Updates samples, RR intervals, and streams. Ignored when paused. */
  ingest(packet: HRPacket): void {
    if (this._paused) return;

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

  /** Begin a new round. Subsequent ingested packets are recorded to this round. */
  startRound(meta?: RoundMeta): void {
    this.currentRound = {
      startTime: this.lastPacketTime ?? Date.now(),
      samples: [],
      rrIntervals: [],
      meta,
    };
  }

  /** End the current round and return its data. Throws if no round is in progress. */
  endRound(meta?: RoundMeta): Round {
    if (!this.currentRound) {
      throw new Error('No round in progress');
    }

    const round: Round = {
      index: this.rounds.length,
      startTime: this.currentRound.startTime,
      endTime: this.lastPacketTime ?? Date.now(),
      samples: this.currentRound.samples,
      rrIntervals: this.currentRound.rrIntervals,
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

  /** Latest ingested heart rate, or `null` if no data yet. */
  currentHR(): number | null {
    return this.hrStream.get() ?? null;
  }

  /** Latest computed HR zone (1–5), or `null` if no data yet. */
  currentZone(): Zone | null {
    return this.zoneStream.get() ?? null;
  }

  /** Seconds elapsed since the first ingested packet (based on packet timestamps). */
  elapsedSeconds(): number {
    if (this.startTime === null || this.lastPacketTime === null) return 0;
    return (this.lastPacketTime - this.startTime) / 1000;
  }

  /** Finalize the session and return the complete Session object. */
  end(): Session {
    const now = this.lastPacketTime ?? Date.now();
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startTime: this.startTime ?? now,
      endTime: now,
      samples: this.samples,
      rrIntervals: this.rrIntervals,
      rounds: this.rounds,
      config: this.config,
      deviceInfo: this._deviceInfo,
      metadata: this._metadata,
    };
  }
}
