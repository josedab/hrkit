import { describe, expect, it } from 'vitest';
import type { AthleteConfig, AthleteState, GroupStats, ZoneHeatmap } from '../group-session.js';
import { GroupSession } from '../group-session.js';
import type { HRPacket } from '../types.js';

function makePacket(hr: number, timestamp: number): HRPacket {
  return { hr, timestamp, rrIntervals: [], contactDetected: true };
}

function makeAthlete(id: string, name: string, maxHR = 200, restHR = 60): AthleteConfig {
  return { id, name, config: { maxHR, restHR, sex: 'male' } };
}

describe('GroupSession', () => {
  it('addAthlete registers an athlete', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    expect(gs.athleteCount).toBe(1);
  });

  it('removeAthlete removes an athlete', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));
    expect(gs.athleteCount).toBe(2);
    gs.removeAthlete('a1');
    expect(gs.athleteCount).toBe(1);
    expect(gs.getAthleteState('a1')).toBeUndefined();
  });

  it('ingest updates athlete state (HR, zone, packetCount)', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice', 200));
    gs.ingest('a1', makePacket(150, 1000));

    const state = gs.getAthleteState('a1');
    expect(state).toBeDefined();
    expect(state!.hr).toBe(150);
    expect(state!.zone).toBeGreaterThanOrEqual(1);
    expect(state!.zone).toBeLessThanOrEqual(5);
    expect(state!.packetCount).toBe(1);
  });

  it('ingest accumulates TRIMP correctly', () => {
    const gs = new GroupSession();
    // maxHR=200, restHR=60, sex=male
    gs.addAthlete(makeAthlete('a1', 'Alice', 200, 60));

    // First packet sets lastTimestamp, no TRIMP yet
    gs.ingest('a1', makePacket(150, 0));
    expect(gs.getAthleteState('a1')!.trimp).toBe(0);

    // Second packet 10s later → durationMin = 10/60000 ≈ 0.000167
    gs.ingest('a1', makePacket(150, 10000));
    const state = gs.getAthleteState('a1')!;
    expect(state.trimp).toBeGreaterThan(0);

    // Verify formula: hrr = (150-60)/(200-60) = 90/140 ≈ 0.6429
    // durationMin = 10000/60000 ≈ 0.1667
    // trimp = 0.1667 * 0.6429 * 0.64 * exp(1.92 * 0.6429)
    const hrr = (150 - 60) / (200 - 60);
    const durationMin = 10000 / 60000;
    const expected = durationMin * hrr * 0.64 * Math.exp(1.92 * hrr);
    expect(state.trimp).toBeCloseTo(Math.round(expected * 100) / 100, 2);
  });

  it('ingest updates peak HR', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));

    gs.ingest('a1', makePacket(140, 1000));
    expect(gs.getAthleteState('a1')!.peakHR).toBe(140);

    gs.ingest('a1', makePacket(180, 2000));
    expect(gs.getAthleteState('a1')!.peakHR).toBe(180);

    gs.ingest('a1', makePacket(160, 3000));
    expect(gs.getAthleteState('a1')!.peakHR).toBe(180); // still 180
  });

  it('athletes$ emits updated state array', () => {
    const gs = new GroupSession();
    const emitted: AthleteState[][] = [];
    gs.athletes$.subscribe((states) => emitted.push(states));

    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.ingest('a1', makePacket(150, 1000));

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    const latest = emitted[emitted.length - 1]!;
    expect(latest).toHaveLength(1);
    expect(latest[0]!.hr).toBe(150);
  });

  it('heatmap$ shows zone distribution across athletes', () => {
    const gs = new GroupSession();
    // maxHR=200, default zones [0.6, 0.7, 0.8, 0.9]
    // Zone thresholds: 120, 140, 160, 180
    gs.addAthlete(makeAthlete('a1', 'Alice', 200));
    gs.addAthlete(makeAthlete('a2', 'Bob', 200));
    gs.addAthlete(makeAthlete('a3', 'Carol', 200));

    const heatmaps: ZoneHeatmap[] = [];
    gs.heatmap$.subscribe((h) => heatmaps.push(h));

    // Alice: HR=100 → Zone 1 (< 120)
    gs.ingest('a1', makePacket(100, 1000));
    // Bob: HR=150 → Zone 3 (140-160)
    gs.ingest('a2', makePacket(150, 1000));
    // Carol: HR=190 → Zone 5 (>= 180)
    gs.ingest('a3', makePacket(190, 1000));

    const latest = heatmaps[heatmaps.length - 1]!;
    expect(latest.zones[1]).toBe(1);
    expect(latest.zones[3]).toBe(1);
    expect(latest.zones[5]).toBe(1);
    expect(latest.total).toBe(3);
  });

  it('stats$ shows correct aggregate stats', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice', 200));
    gs.addAthlete(makeAthlete('a2', 'Bob', 200));

    const stats: GroupStats[] = [];
    gs.stats$.subscribe((s) => stats.push(s));

    gs.ingest('a1', makePacket(140, 1000));
    gs.ingest('a2', makePacket(160, 1000));

    const latest = stats[stats.length - 1]!;
    expect(latest.avgHR).toBe(150); // (140+160)/2
    expect(latest.maxHR).toBe(160);
    expect(latest.activeCount).toBe(2);
    expect(latest.totalCount).toBe(2);
  });

  it('getLeaderboard sorts by HR', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));

    gs.ingest('a1', makePacket(140, 1000));
    gs.ingest('a2', makePacket(170, 1000));

    const board = gs.getLeaderboard('hr');
    expect(board).toHaveLength(2);
    expect(board[0]!.athleteId).toBe('a2');
    expect(board[0]!.rank).toBe(1);
    expect(board[0]!.value).toBe(170);
    expect(board[1]!.athleteId).toBe('a1');
    expect(board[1]!.rank).toBe(2);
  });

  it('getLeaderboard sorts by TRIMP', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice', 200, 60));
    gs.addAthlete(makeAthlete('a2', 'Bob', 200, 60));

    // Give Alice more TRIMP (higher HR sustained)
    gs.ingest('a1', makePacket(180, 0));
    gs.ingest('a1', makePacket(180, 10000));
    gs.ingest('a2', makePacket(100, 0));
    gs.ingest('a2', makePacket(100, 10000));

    const board = gs.getLeaderboard('trimp');
    expect(board[0]!.athleteId).toBe('a1');
    expect(board[0]!.value).toBeGreaterThan(board[1]!.value);
  });

  it('getLeaderboard sorts by peakHR', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));

    gs.ingest('a1', makePacket(190, 1000));
    gs.ingest('a2', makePacket(170, 1000));

    const board = gs.getLeaderboard('peakHR');
    expect(board[0]!.athleteId).toBe('a1');
    expect(board[0]!.value).toBe(190);
    expect(board[1]!.value).toBe(170);
  });

  it('multiple athletes with different zones', () => {
    const gs = new GroupSession();
    // maxHR=200 → thresholds: 120, 140, 160, 180
    gs.addAthlete(makeAthlete('a1', 'Alice', 200));
    gs.addAthlete(makeAthlete('a2', 'Bob', 200));
    gs.addAthlete(makeAthlete('a3', 'Carol', 200));

    gs.ingest('a1', makePacket(110, 1000)); // Zone 1
    gs.ingest('a2', makePacket(135, 1000)); // Zone 2
    gs.ingest('a3', makePacket(185, 1000)); // Zone 5

    expect(gs.getAthleteState('a1')!.zone).toBe(1);
    expect(gs.getAthleteState('a2')!.zone).toBe(2);
    expect(gs.getAthleteState('a3')!.zone).toBe(5);

    const heatmap = gs.getHeatmap();
    expect(heatmap.zones[1]).toBe(1);
    expect(heatmap.zones[2]).toBe(1);
    expect(heatmap.zones[5]).toBe(1);
    expect(heatmap.zones[3]).toBe(0);
    expect(heatmap.zones[4]).toBe(0);
  });

  it('end() returns final states', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));

    gs.ingest('a1', makePacket(150, 1000));
    gs.ingest('a2', makePacket(160, 1000));

    const final = gs.end();
    expect(final).toHaveLength(2);
    expect(final.find((s) => s.id === 'a1')!.hr).toBe(150);
    expect(final.find((s) => s.id === 'a2')!.hr).toBe(160);
  });

  it('inactive athlete detection (no recent packets)', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));

    // Alice gets a packet at t=0
    gs.ingest('a1', makePacket(150, 0));
    // Bob gets a packet at t=10000 (10s later)
    gs.ingest('a2', makePacket(160, 10000));

    // latestGlobalTimestamp is now 10000
    // Alice's lastSeenAgo = (10000 - 0) / 1000 = 10s → inactive
    // Bob's lastSeenAgo = (10000 - 10000) / 1000 = 0s → active
    const alice = gs.getAthleteState('a1')!;
    const bob = gs.getAthleteState('a2')!;

    expect(alice.lastSeenAgo).toBe(10);
    expect(alice.active).toBe(false);
    expect(bob.lastSeenAgo).toBe(0);
    expect(bob.active).toBe(true);
  });

  it('athlete with no packets has Infinity lastSeenAgo', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));

    // Need at least one ingest to set latestGlobalTimestamp
    gs.addAthlete(makeAthlete('a2', 'Bob'));
    gs.ingest('a2', makePacket(150, 5000));

    const state = gs.getAthleteState('a1')!;
    expect(state.lastSeenAgo).toBe(Infinity);
    expect(state.active).toBe(false);
  });

  it('athleteCount getter works', () => {
    const gs = new GroupSession();
    expect(gs.athleteCount).toBe(0);

    gs.addAthlete(makeAthlete('a1', 'Alice'));
    expect(gs.athleteCount).toBe(1);

    gs.addAthlete(makeAthlete('a2', 'Bob'));
    expect(gs.athleteCount).toBe(2);

    gs.removeAthlete('a1');
    expect(gs.athleteCount).toBe(1);
  });

  it('TRIMP skips gaps > 30s', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice', 200, 60));

    gs.ingest('a1', makePacket(150, 0));
    gs.ingest('a1', makePacket(150, 60000)); // 60s gap → skip

    expect(gs.getAthleteState('a1')!.trimp).toBe(0);
  });

  it('removeAthlete updates streams', () => {
    const gs = new GroupSession();
    gs.addAthlete(makeAthlete('a1', 'Alice'));
    gs.addAthlete(makeAthlete('a2', 'Bob'));

    gs.ingest('a1', makePacket(150, 1000));
    gs.ingest('a2', makePacket(160, 1000));

    const states: AthleteState[][] = [];
    gs.athletes$.subscribe((s) => states.push(s));

    gs.removeAthlete('a1');

    const latest = states[states.length - 1]!;
    expect(latest).toHaveLength(1);
    expect(latest[0]!.id).toBe('a2');
  });

  it('ingest ignores unknown athlete', () => {
    const gs = new GroupSession();
    // Should not throw
    gs.ingest('unknown', makePacket(150, 1000));
    expect(gs.athleteCount).toBe(0);
  });
});

describe('GroupSession edge cases', () => {
  it('removeAthlete for unknown ID is no-op', () => {
    const group = new GroupSession();
    group.removeAthlete('nonexistent');
    expect(group.athleteCount).toBe(0);
  });

  it('handles duplicate addAthlete by overwriting', () => {
    const group = new GroupSession();
    group.addAthlete({ id: 'a1', name: 'Alice', config: { maxHR: 185 } });
    group.addAthlete({ id: 'a1', name: 'Alice Updated', config: { maxHR: 190 } });
    expect(group.athleteCount).toBe(1);
    const state = group.getAthleteState('a1');
    expect(state?.name).toBe('Alice Updated');
  });

  it('leaderboard with ties preserves stable order', () => {
    const group = new GroupSession();
    group.addAthlete(makeAthlete('a1', 'Alice'));
    group.addAthlete(makeAthlete('a2', 'Bob'));

    const packet = makePacket(150, 1000);
    group.ingest('a1', packet);
    group.ingest('a2', packet);

    const board = group.getLeaderboard('hr');
    expect(board).toHaveLength(2);
    expect(board[0]!.rank).toBe(1);
    expect(board[1]!.rank).toBe(2);
    // Both have same HR, order should be stable
  });

  it('stats with no active athletes returns zeros', () => {
    const group = new GroupSession();
    group.addAthlete({ id: 'a1', name: 'Alice', config: { maxHR: 185 } });
    // No packets ingested, athlete has no data
    const stats = group.getStats();
    expect(stats.avgHR).toBe(0);
    expect(stats.activeCount).toBe(0);
  });

  it('TRIMP uses correct sex factor for each athlete', () => {
    const group = new GroupSession();
    group.addAthlete({ id: 'male', name: 'M', config: { maxHR: 185, restHR: 60, sex: 'male' } });
    group.addAthlete({ id: 'female', name: 'F', config: { maxHR: 185, restHR: 60, sex: 'female' } });

    const p1 = makePacket(150, 0);
    const p2 = makePacket(150, 10000);

    group.ingest('male', p1);
    group.ingest('female', p1);
    group.ingest('male', p2);
    group.ingest('female', p2);

    const maleState = group.getAthleteState('male')!;
    const femaleState = group.getAthleteState('female')!;

    // Male factor 1.92 > female factor 1.67, so male TRIMP should be higher
    expect(maleState.trimp).toBeGreaterThan(femaleState.trimp);
  });

  it('empty group end returns empty array', () => {
    const group = new GroupSession();
    expect(group.end()).toEqual([]);
  });

  it('uses custom activity timeout', () => {
    const group = new GroupSession({ activityTimeoutSec: 2 });
    group.addAthlete(makeAthlete('a1', 'Alice'));
    group.addAthlete(makeAthlete('a2', 'Bob'));

    // Alice gets a packet at t=0
    group.ingest('a1', makePacket(150, 0));
    // Bob gets a packet at t=3000 (3s later)
    group.ingest('a2', makePacket(160, 3000));

    // latestGlobalTimestamp is now 3000
    // Alice's lastSeenAgo = 3s → inactive with 2s timeout
    // Bob's lastSeenAgo = 0s → active
    const alice = group.getAthleteState('a1')!;
    const bob = group.getAthleteState('a2')!;

    expect(alice.active).toBe(false);
    expect(bob.active).toBe(true);

    // With default 5s timeout, Alice would still be active at 3s
    const defaultGroup = new GroupSession();
    defaultGroup.addAthlete(makeAthlete('a1', 'Alice'));
    defaultGroup.addAthlete(makeAthlete('a2', 'Bob'));
    defaultGroup.ingest('a1', makePacket(150, 0));
    defaultGroup.ingest('a2', makePacket(160, 3000));
    expect(defaultGroup.getAthleteState('a1')!.active).toBe(true);
  });
});
