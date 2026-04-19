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

  it('comments on moderate recovery when ratio is between 0.8 and 0.95', () => {
    const session = sampleSession();
    const analysis = ruleEngineSummary({ session }).analysis;
    // Set baseline so ratio is between 0.8 and 0.95
    if (analysis.hrv) {
      const moderate = analysis.hrv.rmssd / 0.9; // ratio ≈ 0.9
      const out = ruleEngineSummary({ session, baselineRmssd: moderate });
      expect(out.summary.toLowerCase()).toContain('moderate');
    }
  });

  it('comments on strong recovery when ratio >= 0.95', () => {
    const session = sampleSession();
    const analysis = ruleEngineSummary({ session }).analysis;
    if (analysis.hrv) {
      const strongBaseline = analysis.hrv.rmssd / 1.0; // ratio = 1.0
      const out = ruleEngineSummary({ session, baselineRmssd: strongBaseline });
      expect(out.summary.toLowerCase()).toContain('strong');
    }
  });

  it('recognises a heavier-than-average session', () => {
    const out = ruleEngineSummary({
      session: sampleSession(),
      recentTrimps: [10, 12, 8],
    });
    expect(out.summary).toMatch(/harder|easy|light|recover/i);
  });

  it('recognises a lighter-than-average session', () => {
    const out = ruleEngineSummary({
      session: sampleSession(),
      recentTrimps: [200, 250, 300], // avg ~250, session TRIMP <<125
    });
    expect(out.summary).toMatch(/lighter|recovery|easy/i);
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

  it('recommends adding zone 1-2 volume for moderate+ sessions lacking aerobic work', () => {
    const session = sampleSession();
    // All time in zone 4-5
    session.samples = session.samples.map((s) => ({ ...s, hr: 170 }));
    const out = ruleEngineSummary({ session });
    const text = out.recommendations.join(' ').toLowerCase();
    expect(text).toContain('zone');
  });

  it('returns default recommendation for easy sessions', () => {
    const session = sampleSession();
    // Very short, easy session
    session.samples = session.samples.slice(0, 60).map((s) => ({ ...s, hr: 80 }));
    session.endTime = session.startTime + 60000;
    const out = ruleEngineSummary({ session });
    expect(out.recommendations.length).toBeGreaterThan(0);
  });

  it('handles empty recentTrimps gracefully', () => {
    const out = ruleEngineSummary({
      session: sampleSession(),
      recentTrimps: [],
    });
    // Should not crash and should not mention load comparison
    expect(out.summary).not.toContain('harder than your recent');
    expect(out.summary).not.toContain('lighter session compared');
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

  it('handles LLM response with no structured sections', async () => {
    const provider = {
      name: 'plain',
      complete: vi.fn(async () => 'Just a plain text response with no format.'),
    };
    const out = await generateCoachSummary({ session: sampleSession() }, provider);
    expect(out.source).toBe('plain');
    // Falls back to rule-engine values for headline/summary/recommendations
    expect(out.recommendations.length).toBeGreaterThan(0);
  });

  it('passes userNote to LLM prompt', async () => {
    let capturedPrompt = '';
    const provider = {
      name: 'note-test',
      complete: vi.fn(async (input: { user: string }) => {
        capturedPrompt = input.user;
        return 'HEADLINE: ok\nSUMMARY: ok\nRECOMMENDATIONS:\n- ok';
      }),
    };
    await generateCoachSummary({ session: sampleSession(), userNote: 'My legs feel heavy today' }, provider);
    expect(capturedPrompt).toContain('My legs feel heavy today');
  });

  it('passes baseline and recentTrimps to LLM prompt', async () => {
    let capturedPrompt = '';
    const provider = {
      name: 'context-test',
      complete: vi.fn(async (input: { user: string }) => {
        capturedPrompt = input.user;
        return 'HEADLINE: ok\nSUMMARY: ok\nRECOMMENDATIONS:\n- ok';
      }),
    };
    await generateCoachSummary({ session: sampleSession(), baselineRmssd: 45.5, recentTrimps: [50, 60, 70] }, provider);
    expect(capturedPrompt).toContain('Baseline rMSSD');
    expect(capturedPrompt).toContain('Recent TRIMPs');
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

  it('OpenAIProvider uses custom baseUrl and model', async () => {
    const fetch = vi.fn(() => okJson({ choices: [{ message: { content: 'custom' } }] }));
    const p = new OpenAIProvider({
      apiKey: 'k',
      model: 'gpt-4-turbo',
      baseUrl: 'https://custom.api.com',
      fetch: fetch as FetchLike,
    });
    await p.complete({ system: 's', user: 'u' });
    expect(fetch.mock.calls[0]![0]).toContain('custom.api.com');
    const body = JSON.parse(fetch.mock.calls[0]![1]?.body as string);
    expect(body.model).toBe('gpt-4-turbo');
  });

  it('OpenAIProvider returns empty string when response shape is unexpected', async () => {
    const fetch = vi.fn(() => okJson({})); // no choices
    const p = new OpenAIProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('');
  });

  it('AnthropicProvider parses Messages response', async () => {
    const fetch = vi.fn(() => okJson({ content: [{ text: 'claude says hi' }] }));
    const p = new AnthropicProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('claude says hi');
  });

  it('AnthropicProvider throws on non-2xx', async () => {
    const fetch = vi.fn(() => okJson({}, 429));
    const p = new AnthropicProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    await expect(p.complete({ system: 's', user: 'u' })).rejects.toThrow(/HTTP 429/);
  });

  it('AnthropicProvider uses custom baseUrl and model', async () => {
    const fetch = vi.fn(() => okJson({ content: [{ text: 'custom' }] }));
    const p = new AnthropicProvider({
      apiKey: 'k',
      model: 'claude-3-opus-latest',
      baseUrl: 'https://proxy.example.com',
      fetch: fetch as FetchLike,
    });
    await p.complete({ system: 's', user: 'u' });
    expect(fetch.mock.calls[0]![0]).toContain('proxy.example.com');
  });

  it('AnthropicProvider returns empty when response is empty', async () => {
    const fetch = vi.fn(() => okJson({}));
    const p = new AnthropicProvider({ apiKey: 'k', fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('');
  });

  it('OllamaProvider parses local response', async () => {
    const fetch = vi.fn(() => okJson({ message: { content: 'local llm' } }));
    const p = new OllamaProvider({ fetch: fetch as FetchLike });
    const text = await p.complete({ system: 's', user: 'u' });
    expect(text).toBe('local llm');
  });

  it('OllamaProvider throws on non-2xx', async () => {
    const fetch = vi.fn(() => okJson({}, 503));
    const p = new OllamaProvider({ fetch: fetch as FetchLike });
    await expect(p.complete({ system: 's', user: 'u' })).rejects.toThrow(/HTTP 503/);
  });

  it('OllamaProvider uses custom baseUrl and model', async () => {
    const fetch = vi.fn(() => okJson({ message: { content: 'ok' } }));
    const p = new OllamaProvider({ model: 'mistral', baseUrl: 'http://gpu:11434', fetch: fetch as FetchLike });
    await p.complete({ system: 's', user: 'u' });
    expect(fetch.mock.calls[0]![0]).toContain('gpu:11434');
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
  it('works with custom zone thresholds', () => {
    expect(liveCue(100, 3, { maxHR: 200, zones: [0.5, 0.6, 0.7, 0.8] })).toMatch(/push/i);
  });
  it('returns null when exactly in target zone with custom zones', () => {
    // HR 150, maxHR 200, zones [0.5, 0.6, 0.7, 0.8] → zone 4 is 70-80% → 140-160
    expect(liveCue(150, 4, { maxHR: 200, zones: [0.5, 0.6, 0.7, 0.8] })).toBeNull();
  });
});
