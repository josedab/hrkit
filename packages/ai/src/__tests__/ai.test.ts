import type { LLMProvider } from '@hrkit/coach';
import { InMemoryAthleteStore, type Session } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { buildSnapshot, makeTools, planNextWeek } from '../index.js';

function fakeSession(startMs: number, durSec: number, hrFn: (i: number) => number): Session {
  const samples = Array.from({ length: durSec }, (_, i) => ({
    timestamp: startMs + i * 1000,
    hr: hrFn(i),
    rrIntervals: [800],
  }));
  return {
    schemaVersion: 1,
    startTime: startMs,
    endTime: startMs + durSec * 1000,
    samples,
    rrIntervals: samples.flatMap((s) => s.rrIntervals ?? []),
    rounds: [],
    config: { maxHR: 190, restHR: 50, sex: 'neutral' },
  };
}

function seedStore(): InMemoryAthleteStore {
  const store = new InMemoryAthleteStore();
  const now = Date.now();
  for (let d = 14; d >= 1; d--) {
    const start = now - d * 86400000;
    store.saveSession(fakeSession(start, 1800, (i) => 130 + Math.sin(i / 60) * 10));
  }
  return store;
}

class StubLLM implements LLMProvider {
  readonly name = 'stub';
  constructor(private readonly response: string) {}
  async complete() {
    return this.response;
  }
}

describe('@hrkit/ai snapshot', () => {
  it('builds non-empty snapshot from a seeded store', () => {
    const store = seedStore();
    const snap = buildSnapshot(makeTools(store));
    expect(snap.recentSessions.length).toBeGreaterThan(0);
    expect(snap.hrvTrend.length).toBeGreaterThan(0);
    expect(snap.load.length).toBeGreaterThan(0);
    expect(snap.rmssdBaseline).not.toBeNull();
  });

  it('returns null baselines on empty store', () => {
    const snap = buildSnapshot(makeTools(new InMemoryAthleteStore()));
    expect(snap.rmssdBaseline).toBeNull();
    expect(snap.acwr).toBeNull();
    expect(snap.weekTRIMP).toBe(0);
  });
});

describe('@hrkit/ai planNextWeek', () => {
  it('parses a valid LLM JSON response with DSL', async () => {
    const store = seedStore();
    const llm = new StubLLM(
      JSON.stringify([
        { day: 1, rationale: 'easy', dsl: 'name: Easy run\nwarmup 10m @zone 2\nwork 20m @zone 2\ncooldown 5m @zone 1' },
        { day: 3, rationale: 'tempo', dsl: 'name: Tempo\nwarmup 10m @zone 2\nwork 20m @zone 4\ncooldown 5m @zone 1' },
      ]),
    );
    const out = await planNextWeek({ store, goal: 'maintain', llm });
    expect(out.sessions).toHaveLength(2);
    expect(out.sessions[0]!.protocol.steps.length).toBeGreaterThan(0);
  });

  it('strips code fences and trailing commentary', async () => {
    const llm = new StubLLM('Here is your plan:\n```json\n[{"day":1,"dsl":"name: A\\nwork 10m @zone 2"}]\n```\nEnjoy!');
    const out = await planNextWeek({ store: seedStore(), goal: 'go', llm });
    expect(out.sessions).toHaveLength(1);
  });

  it('reports warning when DSL fails to parse but does not throw', async () => {
    const llm = new StubLLM(
      JSON.stringify([
        { day: 1, dsl: 'this is not valid dsl' },
        { day: 2, dsl: 'name: ok\nwork 5m @zone 2' },
      ]),
    );
    const out = await planNextWeek({ store: seedStore(), goal: 'x', llm });
    expect(out.sessions).toHaveLength(1);
    expect(out.warnings.some((w) => w.includes('day 1'))).toBe(true);
  });

  it('throws on completely unparseable LLM output', async () => {
    const llm = new StubLLM('I refuse to respond.');
    await expect(planNextWeek({ store: seedStore(), goal: 'x', llm })).rejects.toThrow();
  });

  it('flags excessive Z5 volume via guardrails', async () => {
    const llm = new StubLLM(
      JSON.stringify([{ day: 1, dsl: 'name: Crusher\nrepeat 10\n  work 90s @zone 5\n  rest 60s @zone 1\nend' }]),
    );
    const out = await planNextWeek({ store: seedStore(), goal: 'x', llm, guardrails: { maxZ5MinutesPerSession: 10 } });
    expect(out.warnings.some((w) => w.includes('zone-5 volume'))).toBe(true);
  });

  it('flags too-short rest after high-intensity step', async () => {
    const llm = new StubLLM(JSON.stringify([{ day: 1, dsl: 'name: Sprint\nwork 30s @zone 5\nrest 10s @zone 1' }]));
    const out = await planNextWeek({ store: seedStore(), goal: 'x', llm, guardrails: { minRestSeconds: 30 } });
    expect(out.warnings.some((w) => w.includes('below 30s'))).toBe(true);
  });

  it('flags too many sessions per week', async () => {
    const arr = Array.from({ length: 8 }, (_, i) => ({ day: i + 1, dsl: `name: D${i}\nwork 10m @zone 2` }));
    const out = await planNextWeek({
      store: seedStore(),
      goal: 'x',
      llm: new StubLLM(JSON.stringify(arr)),
      guardrails: { maxSessionsPerWeek: 6 },
    });
    expect(out.warnings.some((w) => w.includes('sessions/week'))).toBe(true);
  });
});
