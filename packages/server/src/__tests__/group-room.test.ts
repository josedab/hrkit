import type { AthleteConfig, HRPacket } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import {
  applyPacketToRoom,
  DEFAULT_PRESENCE_TIMEOUT_MS,
  InMemoryRoomStore,
  joinRoom,
  snapshotRoom,
} from '../group-room.js';

const athlete: AthleteConfig = {
  id: 'a1',
  name: 'Alice',
  config: { maxHR: 190 },
};

const packet = (hr: number, ts: number): HRPacket => ({
  hr,
  rrs: [],
  contact: 'detected',
  timestamp: ts,
});

describe('InMemoryRoomStore', () => {
  it('creates, lists, and deletes rooms', () => {
    const s = new InMemoryRoomStore();
    s.create('class-a');
    s.create('class-b');
    expect(s.size()).toBe(2);
    expect(s.list().sort()).toEqual(['class-a', 'class-b']);
    expect(s.delete('class-a')).toBe(true);
    expect(s.size()).toBe(1);
  });

  it('rejects empty / whitespace room ids', () => {
    const s = new InMemoryRoomStore();
    expect(() => s.create('')).toThrow();
    expect(() => s.create('a b')).toThrow();
  });

  it('rejects duplicate room ids', () => {
    const s = new InMemoryRoomStore();
    s.create('x');
    expect(() => s.create('x')).toThrow(/already exists/);
  });

  it('honours room capacity', () => {
    const s = new InMemoryRoomStore(1);
    s.create('a');
    expect(() => s.create('b')).toThrow(/capacity/);
  });
});

describe('room operations', () => {
  it('joins athletes and ingests packets', () => {
    const s = new InMemoryRoomStore();
    s.create('r');
    expect(joinRoom(s, 'r', athlete)).toBe(true);
    expect(applyPacketToRoom(s, 'r', 'a1', packet(150, 1000))).toBe(true);

    const snap = snapshotRoom(s, 'r');
    expect(snap?.athletes).toHaveLength(1);
    expect(snap?.athletes[0]?.hr).toBe(150);
    expect(snap?.leaderboard[0]?.athleteId).toBe('a1');
  });

  it('returns false for unknown room', () => {
    const s = new InMemoryRoomStore();
    expect(joinRoom(s, 'nope', athlete)).toBe(false);
    expect(applyPacketToRoom(s, 'nope', 'a1', packet(150, 1000))).toBe(false);
    expect(snapshotRoom(s, 'nope')).toBeUndefined();
  });
});

describe('presence pruning', () => {
  it('removes athletes that have gone stale', () => {
    const s = new InMemoryRoomStore();
    s.create('r');
    joinRoom(s, 'r', athlete);
    applyPacketToRoom(s, 'r', 'a1', packet(150, 1000), 10_000);
    const pruned = s.pruneStale(DEFAULT_PRESENCE_TIMEOUT_MS, 10_000 + DEFAULT_PRESENCE_TIMEOUT_MS + 1);
    expect(pruned).toEqual([{ roomId: 'r', removed: ['a1'] }]);
    expect(snapshotRoom(s, 'r')?.athletes).toHaveLength(0);
  });

  it('keeps athletes still inside the timeout window', () => {
    const s = new InMemoryRoomStore();
    s.create('r');
    joinRoom(s, 'r', athlete);
    applyPacketToRoom(s, 'r', 'a1', packet(150, 1000), 10_000);
    const pruned = s.pruneStale(DEFAULT_PRESENCE_TIMEOUT_MS, 10_000 + 1_000);
    expect(pruned).toEqual([]);
  });
});
