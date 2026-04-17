import { SESSION_SCHEMA_VERSION, type Session } from '@hrkit/core';
import { describe, expect, it, vi } from 'vitest';
import {
  AnthropicProvider,
  type FetchLike,
  generateCoachSummary,
  liveCue,
  OllamaProvider,
  OpenAIProvider,
  ruleEngineSummary,
} from '../index.js';

const sampleSession = (): Session => {
  // 30 minutes of varying HR
  const samples = [];
  const rr = [];
  const start = 1700000000000;
  for (let i = 0; i < 1800; i++) {
    const hr = 130 + Math.sin(i / 50) * 20;
    samples.push({ timestamp: start + i * 1000, hr });
    rr.push(60000 / hr);
  }
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime: start,
    endTime: start + 1800000,
    samples,
    rrIntervals: rr,
    rounds: [],
    config: { maxHR: 185, restHR: 50, sex: 'neutral' },
  };
};

describe('ruleEngineSummary', () => {
  it('returns deterministic output with all fields populated', () => {
    const out = ruleEngineSummary({ session: sampleSession() });
    expect(out.headline).toMatch(/min/);
    expect(out.summary.length).toBeGreaterThan(20);
    expect(out.recommendations.length).toBeGreaterThan(0);
    expect(out.source).toBe('rule-engine');
    expect([1, 2, 3, 4, 5]).toContain(out.dominantZone);
  });

  it('comments on recovery when baseline rMSSD provided', () => {
    const out = ruleEngineSummary({
      session: sampleSession(),
      baselineRmssd: 1000, // intentionally high so ratio < 0.8
    });
    expect(out.summary.toLowerCase()).toContain('rest');
  });

  it('recognises a heavier-than-average session', () => {
    const out = ruleEngineSummary({
      session: sampleSession(),
      recentTrimps: [10, 12, 8],
    });
    expect(out.summary).toMatch(/harder|easy|light|recover/i);
  });

  it('recommends recovery actions on intense + poor recovery sessions', () => {
    const big = sampleSession();
    // amplify HR to push TRIMP into "hard"+ and Z5 dominance
    big.samples = big.samples.map((s) => ({ ...s, hr: 180 }));
    const out = ruleEngineSummary({ session: big, baselineRmssd: 1000 });
    // Must contain at least one cautionary recommendation
    const text = out.recommendations.join(' ').toLowerCase();
    expect(/(rest|easy|aerobic|overtraining|zone 5)/.test(text)).toBe(true);
  });
});

describe('generateCoachSummary', () => {
  it('falls back to rule engine when no provider', async () => {
    const out = await generateCoachSummary({ session: sampleSession() });
    expect(out.source).toBe('rule-engine');
  });

  it('uses provider output when LLM responds', async () => {
    const provider = {
      name: 'mock-llm',
      complete: vi.fn(
        async () => 'HEADLINE: Great work!\nSUMMARY: You crushed it.\nRECOMMENDATIONS:\n- Hydrate\n- Sleep',
      ),
    };
    const out = await generateCoachSummary({ session: sampleSession() }, provider);
    expect(out.source).toBe('mock-llm');
    expect(out.headline).toContain('Great work');
    expect(out.recommendations).toContain('Hydrate');
  });

  it('falls back to rule engine when LLM throws', async () => {
    const provider = {
      name: 'broken',
      complete: vi.fn(async () => {
        throw new Error('rate limit');
      }),
    };
    const out = await generateCoachSummary({ session: sampleSession() }, provider);
    expect(out.source).toBe('rule-engine');
  });
});

const okJson = (body: unknown, status = 200): ReturnType<FetchLike> =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: async () => '', json: async () => body });

describe('LLM providers', () => {
  it('OpenAIProvider parses chat completions response', async () => {
    const fetch = vi.fn(() => okJson({ choices: [{ message: { content: 'hello world' } }] }));
    const p = new OpenAIProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('hello world');
    expect(fetch.mock.calls[0]![0]).toContain('/v1/chat/completions');
  });

  it('AnthropicProvider parses Messages response', async () => {
    const fetch = vi.fn(() => okJson({ content: [{ text: 'claude says hi' }] }));
    const p = new AnthropicProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('claude says hi');
  });

  it('OllamaProvider parses local response', async () => {
    const fetch = vi.fn(() => okJson({ message: { content: 'local llm' } }));
    const p = new OllamaProvider({ fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('local llm');
  });

  it('throws on non-2xx', async () => {
    const fetch = vi.fn(() => okJson({}, 500));
    const p = new OpenAIProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    await expect(p.complete({ system: 's', user: 'u' })).rejects.toThrow(/HTTP 500/);
  });
});

describe('liveCue', () => {
  it('returns null when in target zone', () => {
    // HR 135 with maxHR 185 → zone 3
    expect(liveCue(135, 3, { maxHR: 185, restHR: 50 })).toBeNull();
  });
  it('tells athlete to ease back when above', () => {
    expect(liveCue(180, 2, { maxHR: 185 })).toMatch(/ease back/i);
  });
  it('tells athlete to push when below', () => {
    expect(liveCue(80, 4, { maxHR: 185 })).toMatch(/push/i);
  });
});
