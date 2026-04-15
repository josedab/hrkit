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
} from './types.js';
import { hrToZone } from './zones.js';

type Zone = 1 | 2 | 3 | 4 | 5;

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

export class SessionRecorder {
  private config: SessionConfig;
  private zoneConfig: HRZoneConfig;
  private startTime: number | null = null;
  private samples: TimestampedHR[] = [];
  private rrIntervals: number[] = [];
  private rounds: Round[] = [];
  private currentRound: {
    startTime: number;
    samples: TimestampedHR[];
    rrIntervals: number[];
    meta?: RoundMeta;
  } | null = null;

  private hrStream = new SimpleStream<number>();
  private zoneStream = new SimpleStream<Zone>();

  readonly hr$: ReadableStream<number> = this.hrStream;
  readonly zone$: ReadableStream<Zone> = this.zoneStream;

  constructor(config: SessionConfig) {
    this.config = config;
    this.zoneConfig = {
      maxHR: config.maxHR,
      restHR: config.restHR,
      zones: config.zones ?? [0.6, 0.7, 0.8, 0.9],
    };
  }

  ingest(packet: HRPacket): void {
    if (this.startTime === null) {
      this.startTime = packet.timestamp;
    }

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

  startRound(meta?: RoundMeta): void {
    this.currentRound = {
      startTime: Date.now(),
      samples: [],
      rrIntervals: [],
      meta,
    };
  }

  endRound(meta?: RoundMeta): Round {
    if (!this.currentRound) {
      throw new Error('No round in progress');
    }

    const round: Round = {
      index: this.rounds.length,
      startTime: this.currentRound.startTime,
      endTime: Date.now(),
      samples: this.currentRound.samples,
      rrIntervals: this.currentRound.rrIntervals,
      meta: meta ?? this.currentRound.meta,
    };

    this.rounds.push(round);
    this.currentRound = null;
    return round;
  }

  currentHR(): number | null {
    return this.hrStream.get() ?? null;
  }

  currentZone(): Zone | null {
    return this.zoneStream.get() ?? null;
  }

  elapsedSeconds(): number {
    if (this.startTime === null) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  end(): Session {
    return {
      startTime: this.startTime ?? Date.now(),
      endTime: Date.now(),
      samples: this.samples,
      rrIntervals: this.rrIntervals,
      rounds: this.rounds,
      config: this.config,
    };
  }
}
