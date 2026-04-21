import {
  type AthleteConfig,
  type AthleteState,
  GroupSession,
  type GroupSessionConfig,
  HRKitError,
  type HRPacket,
  type LeaderboardEntry,
  ValidationError,
} from '@hrkit/core';

/**
 * In-memory multi-tenant room registry. One process can host many concurrent
 * group classes; each gets its own GroupSession + presence map.
 *
 * Designed as the simplest correct adapter. For multi-instance deployments,
 * provide an alternative implementation (Redis, Durable Objects) behind the
 * same RoomStore contract.
 */
export interface RoomStore {
  create(roomId: string, config?: GroupSessionConfig): GroupRoom;
  get(roomId: string): GroupRoom | undefined;
  delete(roomId: string): boolean;
  list(): string[];
  size(): number;
}

export interface GroupRoom {
  readonly roomId: string;
  readonly session: GroupSession;
  readonly createdAt: number;
  /** athleteId → last-seen epoch ms. Used for presence pruning. */
  readonly presence: Map<string, number>;
}

/** Default presence timeout — drop athletes after 60s of silence. */
export const DEFAULT_PRESENCE_TIMEOUT_MS = 60_000;

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, GroupRoom>();

  /** Optional cap to avoid runaway memory in shared deployments. */
  constructor(private readonly maxRooms = 1000) {}

  create(roomId: string, config?: GroupSessionConfig): GroupRoom {
    if (!roomId || /\s/.test(roomId)) {
      throw new ValidationError('roomId must be non-empty and contain no whitespace');
    }
    if (this.rooms.has(roomId)) {
      throw new ValidationError(`room ${roomId} already exists`);
    }
    if (this.rooms.size >= this.maxRooms) {
      throw new HRKitError('room capacity exceeded', 'CAPACITY_EXCEEDED');
    }
    const room: GroupRoom = {
      roomId,
      session: new GroupSession(config),
      createdAt: Date.now(),
      presence: new Map(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: string): GroupRoom | undefined {
    return this.rooms.get(roomId);
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  list(): string[] {
    return Array.from(this.rooms.keys());
  }

  size(): number {
    return this.rooms.size;
  }

  /** Drop athletes that haven't sent a packet within `timeoutMs`. */
  pruneStale(
    timeoutMs: number = DEFAULT_PRESENCE_TIMEOUT_MS,
    now: number = Date.now(),
  ): { roomId: string; removed: string[] }[] {
    const result: { roomId: string; removed: string[] }[] = [];
    for (const room of this.rooms.values()) {
      const removed: string[] = [];
      for (const [athleteId, lastSeen] of room.presence) {
        if (now - lastSeen > timeoutMs) {
          room.session.removeAthlete(athleteId);
          room.presence.delete(athleteId);
          removed.push(athleteId);
        }
      }
      if (removed.length > 0) result.push({ roomId: room.roomId, removed });
    }
    return result;
  }
}

// ── Convenience façade for routing layers ──────────────────────────────

/**
 * Add an athlete to a room. Returns false if the room does not exist.
 * Idempotent: re-adding the same athlete updates their config.
 */
export function joinRoom(store: RoomStore, roomId: string, athlete: AthleteConfig): boolean {
  const room = store.get(roomId);
  if (!room) return false;
  room.session.addAthlete(athlete);
  room.presence.set(athlete.id, Date.now());
  return true;
}

/** Apply a packet from one athlete to a room and update presence. */
export function applyPacketToRoom(
  store: RoomStore,
  roomId: string,
  athleteId: string,
  packet: HRPacket,
  now: number = Date.now(),
): boolean {
  const room = store.get(roomId);
  if (!room) return false;
  room.session.ingest(athleteId, packet);
  room.presence.set(athleteId, now);
  return true;
}

/** Snapshot a room's current state — useful for REST endpoints. */
export interface RoomSnapshot {
  roomId: string;
  athletes: AthleteState[];
  leaderboard: LeaderboardEntry[];
  createdAt: number;
}

export function snapshotRoom(
  store: RoomStore,
  roomId: string,
  metric: 'hr' | 'peakHR' | 'trimp' = 'hr',
): RoomSnapshot | undefined {
  const room = store.get(roomId);
  if (!room) return undefined;
  // SimpleStream replays the current value to new subscribers (BehaviorSubject
  // semantics). Synchronously capture and immediately unsubscribe.
  let athletes: AthleteState[] = [];
  const unsub = room.session.athletes$.subscribe((s) => {
    athletes = s;
  });
  unsub();
  return {
    roomId: room.roomId,
    athletes,
    leaderboard: room.session.getLeaderboard(metric),
    createdAt: room.createdAt,
  };
}
