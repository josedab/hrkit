import { describe, expect, it } from 'vitest';
import { evaluateRule, loadRoster, removeAthlete, rosterCsv, saveRoster, upsertAthlete } from '../coach.js';

class MemStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('evaluateRule', () => {
  it('fires hr_above only after sustain window passes', () => {
    const rule = { type: 'hr_above' as const, threshold: 180, sustainMs: 5000 };
    const state = { at: 0, matchedSince: null, lastFiredAt: null };
    expect(evaluateRule(rule, 185, 5, state, 0)).toBeNull();
    expect(evaluateRule(rule, 185, 5, state, 4_000)).toBeNull();
    expect(evaluateRule(rule, 185, 5, state, 5_000)).not.toBeNull();
  });
  it('debounces with cooldown', () => {
    const rule = { type: 'hr_above' as const, threshold: 180 };
    const state = { at: 0, matchedSince: null, lastFiredAt: null };
    expect(evaluateRule(rule, 185, 5, state, 0)).not.toBeNull();
    expect(evaluateRule(rule, 185, 5, state, 1_000)).toBeNull();
    expect(evaluateRule(rule, 185, 5, state, 31_000)).not.toBeNull();
  });
  it('resets when condition stops matching', () => {
    const rule = { type: 'hr_below' as const, threshold: 60, sustainMs: 2000 };
    const state = { at: 0, matchedSince: null, lastFiredAt: null };
    evaluateRule(rule, 50, undefined, state, 0);
    expect(state.matchedSince).toBe(0);
    evaluateRule(rule, 70, undefined, state, 1_000);
    expect(state.matchedSince).toBeNull();
  });
});

describe('roster persistence', () => {
  it('round-trips via storage', () => {
    const s = new MemStorage();
    saveRoster(s, [{ id: 'a1', name: 'Alice' }]);
    expect(loadRoster(s)).toEqual([{ id: 'a1', name: 'Alice' }]);
  });
  it('upsert replaces existing', () => {
    const r = upsertAthlete([{ id: 'a1', name: 'Alice' }], { id: 'a1', name: 'Alicia' });
    expect(r[0]?.name).toBe('Alicia');
  });
  it('remove drops by id', () => {
    expect(
      removeAthlete(
        [
          { id: 'a1', name: 'A' },
          { id: 'a2', name: 'B' },
        ],
        'a1',
      ),
    ).toEqual([{ id: 'a2', name: 'B' }]);
  });
});

describe('rosterCsv', () => {
  it('emits header + rows', () => {
    const csv = rosterCsv([{ athleteId: 'a', name: 'Alice', hr: 120, zone: 3, rmssd: 35.4, atl: 50 }]);
    expect(csv.split('\n')[0]).toBe('athlete_id,name,hr,zone,rmssd,atl');
    expect(csv).toContain('Alice,120,3,35.4,50.0');
  });
  it('escapes commas in names', () => {
    const csv = rosterCsv([{ athleteId: 'a', name: 'Smith, Bob', hr: 100 }]);
    expect(csv).toContain('"Smith, Bob"');
  });
});
