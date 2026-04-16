import { SimpleStream } from './stream.js';
import type { HRPacket, HRZoneConfig, ReadableStream, SessionConfig } from './types.js';
import { hrToZone } from './zones.js';

// ── Public Types ────────────────────────────────────────────────────────

/** Configuration for a single athlete in a group session. */
export interface AthleteConfig {
  /** Unique athlete identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Athlete's session/zone config. */
  config: SessionConfig;
}

/** Real-time state for a single athlete. */
export interface AthleteState {
  id: string;
  name: string;
  /** Current heart rate (0 if no data yet). */
  hr: number;
  /** Current zone (1-5). */
  zone: Zone;
  /** Peak HR seen in this session. */
  peakHR: number;
  /** Cumulative TRIMP. */
  trimp: number;
  /** Total packets received. */
  packetCount: number;
  /** Seconds since last packet. */
  lastSeenAgo: number;
  /** Whether athlete is currently active (packet within last 5s). */
  active: boolean;
}

/** Leaderboard entry (sorted by a chosen metric). */
export interface LeaderboardEntry {
  rank: number;
  athleteId: string;
  athleteName: string;
  value: number;
}

/** Zone heatmap: count of athletes in each zone. */
export interface ZoneHeatmap {
  zones: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
}

/** Aggregate stats for the group. */
export interface GroupStats {
  /** Average HR across all active athletes. */
  avgHR: number;
  /** Max HR across all athletes. */
  maxHR: number;
  /** Number of active athletes. */
  activeCount: number;
  /** Total athletes registered. */
  totalCount: number;
  /** Group average zone. */
  avgZone: number;
}

// ── Internal Types ──────────────────────────────────────────────────────

interface InternalAthleteState {
  config: AthleteConfig;
  zoneConfig: HRZoneConfig;
  hr: number;
  zone: Zone;
  peakHR: number;
  trimp: number;
  packetCount: number;
  lastPacketTime: number;
  lastTimestamp: number;
  restHR: number;
  maxHR: number;
  sex: 'male' | 'female' | 'neutral';
}

type Zone = 1 | 2 | 3 | 4 | 5;

/** Configuration options for a GroupSession. */
export interface GroupSessionConfig {
  /** Seconds of no data before an athlete is considered inactive. Default: 5. */
  activityTimeoutSec?: number;
}

// ── Sex Factor Constants ────────────────────────────────────────────────

const SEX_FACTORS: Record<'male' | 'female' | 'neutral', number> = {
  male: 1.92,
  female: 1.67,
  neutral: 1.8,
};

/** Default resting heart rate (BPM) when not specified in athlete config. */
const DEFAULT_REST_HR = 60;
/** Maximum sample gap (minutes) for incremental TRIMP calculation. Gaps exceeding this are skipped. */
const MAX_TRIMP_GAP_MIN = 0.5;

const DEFAULT_ZONES: [number, number, number, number] = [0.6, 0.7, 0.8, 0.9];

// ── GroupSession ────────────────────────────────────────────────────────

/**
 * Orchestrates a multi-athlete group session.
 * Each athlete is identified by a unique ID. HR packets are ingested per-athlete.
 * Provides aggregate streams for instructor dashboards.
 */
export class GroupSession {
  private athletes = new Map<string, InternalAthleteState>();
  private latestGlobalTimestamp = 0;
  private activityTimeoutSec: number;

  private stateStream = new SimpleStream<AthleteState[]>();
  private heatmapStream = new SimpleStream<ZoneHeatmap>();
  private statsStream = new SimpleStream<GroupStats>();

  /** Observable: full state of all athletes (updated on any packet). */
  readonly athletes$: ReadableStream<AthleteState[]> = this.stateStream;
  /** Observable: zone heatmap (updated on any packet). */
  readonly heatmap$: ReadableStream<ZoneHeatmap> = this.heatmapStream;
  /** Observable: group aggregate stats. */
  readonly stats$: ReadableStream<GroupStats> = this.statsStream;

  constructor(config?: GroupSessionConfig) {
    this.activityTimeoutSec = config?.activityTimeoutSec ?? 5;
  }

  /**
   * Register an athlete for this group session.
   *
   * @param config - Athlete identifier, name, and session/zone config.
   */
  addAthlete(config: AthleteConfig): void {
    const restHR = config.config.restHR ?? DEFAULT_REST_HR;
    const maxHR = config.config.maxHR;
    const zones = config.config.zones ?? DEFAULT_ZONES;
    const sex = config.config.sex ?? 'neutral';

    const zoneConfig: HRZoneConfig = { maxHR, restHR, zones };

    this.athletes.set(config.id, {
      config,
      zoneConfig,
      hr: 0,
      zone: 1,
      peakHR: 0,
      trimp: 0,
      packetCount: 0,
      lastPacketTime: -1,
      lastTimestamp: -1,
      restHR,
      maxHR,
      sex,
    });
  }

  /**
   * Remove an athlete from the group session.
   *
   * @param athleteId - Unique athlete identifier.
   */
  removeAthlete(athleteId: string): void {
    this.athletes.delete(athleteId);
    this.emitAll();
  }

  /**
   * Ingest an HR packet for a specific athlete.
   * Silently skips packets for unknown athlete IDs.
   *
   * @param athleteId - Unique athlete identifier.
   * @param packet - Parsed HR packet.
   */
  ingest(athleteId: string, packet: HRPacket): void {
    const athlete = this.athletes.get(athleteId);
    if (!athlete) return;

    // Update latest global timestamp
    if (packet.timestamp > this.latestGlobalTimestamp) {
      this.latestGlobalTimestamp = packet.timestamp;
    }

    // Update HR and zone
    athlete.hr = packet.hr;
    athlete.zone = hrToZone(packet.hr, athlete.zoneConfig);
    athlete.packetCount++;
    athlete.lastPacketTime = packet.timestamp;

    // Update peak HR
    if (packet.hr > athlete.peakHR) {
      athlete.peakHR = packet.hr;
    }

    // Accumulate TRIMP incrementally
    if (athlete.lastTimestamp >= 0) {
      const durationMin = (packet.timestamp - athlete.lastTimestamp) / 60000;
      if (durationMin > 0 && durationMin <= MAX_TRIMP_GAP_MIN) {
        const hrRange = athlete.maxHR - athlete.restHR;
        if (hrRange > 0) {
          const hrr = Math.max(0, Math.min(1, (packet.hr - athlete.restHR) / hrRange));
          const sexFactor = SEX_FACTORS[athlete.sex];
          athlete.trimp += durationMin * hrr * 0.64 * Math.exp(sexFactor * hrr);
        }
      }
    }
    athlete.lastTimestamp = packet.timestamp;

    this.emitAll();
  }

  /**
   * Get the current state of a specific athlete.
   *
   * @param athleteId - Unique athlete identifier.
   * @returns The athlete's {@link AthleteState}, or `undefined` if not registered.
   */
  getAthleteState(athleteId: string): AthleteState | undefined {
    const athlete = this.athletes.get(athleteId);
    if (!athlete) return undefined;
    return this.toAthleteState(athlete);
  }

  /** Get the zone heatmap. */
  getHeatmap(): ZoneHeatmap {
    return this.computeHeatmap();
  }

  /** Get the group stats. */
  getStats(): GroupStats {
    return this.computeStats();
  }

  /**
   * Get a leaderboard sorted by the given metric.
   *
   * @param metric - Metric to rank by: 'hr' (current), 'peakHR', or 'trimp'.
   * @returns Ranked array of {@link LeaderboardEntry} sorted descending by value.
   */
  getLeaderboard(metric: 'hr' | 'peakHR' | 'trimp'): LeaderboardEntry[] {
    const entries = Array.from(this.athletes.values())
      .map((a) => ({
        athleteId: a.config.id,
        athleteName: a.config.name,
        value: a[metric],
      }))
      .sort((a, b) => b.value - a.value);

    return entries.map((e, i) => ({ rank: i + 1, ...e }));
  }

  /** Get the number of registered athletes. */
  get athleteCount(): number {
    return this.athletes.size;
  }

  /**
   * End the group session and return final states.
   *
   * @returns Array of {@link AthleteState} for all registered athletes.
   */
  end(): AthleteState[] {
    return Array.from(this.athletes.values()).map((a) => this.toAthleteState(a));
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  private toAthleteState(a: InternalAthleteState): AthleteState {
    const lastSeenAgo = a.lastPacketTime < 0 ? Infinity : (this.latestGlobalTimestamp - a.lastPacketTime) / 1000;

    return {
      id: a.config.id,
      name: a.config.name,
      hr: a.hr,
      zone: a.zone,
      peakHR: a.peakHR,
      trimp: Math.round(a.trimp * 100) / 100,
      packetCount: a.packetCount,
      lastSeenAgo,
      active: lastSeenAgo < this.activityTimeoutSec,
    };
  }

  private computeHeatmap(): ZoneHeatmap {
    const zones: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    for (const a of this.athletes.values()) {
      if (a.packetCount > 0) {
        zones[a.zone]++;
        total++;
      }
    }

    return { zones, total };
  }

  private computeStats(): GroupStats {
    const all = Array.from(this.athletes.values());
    const active = all.filter((a) => {
      if (a.lastPacketTime < 0) return false;
      return (this.latestGlobalTimestamp - a.lastPacketTime) / 1000 < this.activityTimeoutSec;
    });

    const avgHR = active.length > 0 ? Math.round(active.reduce((sum, a) => sum + a.hr, 0) / active.length) : 0;

    const maxHR = all.reduce((max, a) => Math.max(max, a.peakHR), 0);

    const avgZone = active.length > 0 ? Math.round(active.reduce((sum, a) => sum + a.zone, 0) / active.length) : 0;

    return {
      avgHR,
      maxHR,
      activeCount: active.length,
      totalCount: all.length,
      avgZone,
    };
  }

  private emitAll(): void {
    const states = Array.from(this.athletes.values()).map((a) => this.toAthleteState(a));
    this.stateStream.emit(states);
    this.heatmapStream.emit(this.computeHeatmap());
    this.statsStream.emit(this.computeStats());
  }
}
