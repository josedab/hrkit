export { SDK_NAME, SDK_VERSION } from './version.js';

import { HRKitError, hrToZone, RequestError, rmssd, type SessionAnalysis } from '@hrkit/core';
import { type CoachInput, type CoachOutput, ruleEngineSummary } from './rule-engine.js';

// ── Public types ────────────────────────────────────────────────────────

export type { CoachInput, CoachOutput } from './rule-engine.js';
export { ruleEngineSummary } from './rule-engine.js';

/** Provider-agnostic LLM interface. Implementations call OpenAI/Anthropic/Ollama. */
export interface LLMProvider {
  readonly name: string;
  /** Complete a chat-style prompt; returns the assistant's text response. */
  complete(input: { system: string; user: string }): Promise<string>;
}

// ── LLM-augmented summary ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an experienced endurance and strength coach.
You give short, evidence-based, conservative advice based on heart-rate session data.
You do not diagnose medical conditions. If something looks abnormal, advise the
athlete to consult a clinician. Keep responses under 200 words. Use second-person
voice ("you", "your"). Never invent numbers — only use the metrics provided.`;

function buildUserPrompt(input: CoachInput, analysis: SessionAnalysis): string {
  const lines = [
    `Session length: ${Math.round(analysis.zones.total / 60)} minutes`,
    `TRIMP: ${Math.round(analysis.trimp)}`,
    `Zone time (s): Z1=${analysis.zones.zones[1]} Z2=${analysis.zones.zones[2]} Z3=${analysis.zones.zones[3]} Z4=${analysis.zones.zones[4]} Z5=${analysis.zones.zones[5]}`,
    analysis.hrv ? `Session rMSSD: ${analysis.hrv.rmssd.toFixed(1)} ms` : '',
    input.baselineRmssd ? `Baseline rMSSD: ${input.baselineRmssd.toFixed(1)} ms` : '',
    input.recentTrimps?.length
      ? `Recent TRIMPs (last ${input.recentTrimps.length} sessions): ${input.recentTrimps.map((v) => Math.round(v)).join(', ')}`
      : '',
    input.userNote ? `Athlete note: "${input.userNote.slice(0, 240)}"` : '',
  ];
  return [
    'Summarise this session, comment on intensity vs recovery, and give 2-3 short recommendations.',
    'Format your response as: HEADLINE: <one line>\\nSUMMARY: <2-4 sentences>\\nRECOMMENDATIONS:\\n- <bullet>\\n- <bullet>',
    '',
    ...lines.filter(Boolean),
  ].join('\n');
}

function parseLLMOutput(text: string, fallback: CoachOutput): CoachOutput {
  const headlineMatch = /HEADLINE\s*:\s*(.+)/i.exec(text);
  const summaryMatch = /SUMMARY\s*:\s*([\s\S]+?)(?=RECOMMENDATIONS|$)/i.exec(text);
  const recsMatch = /RECOMMENDATIONS\s*:\s*([\s\S]+)/i.exec(text);
  const recs = recsMatch
    ? recsMatch[1]!
        .split('\n')
        .map((s) => s.replace(/^[\s\-*•]+/, '').trim())
        .filter((s) => s.length > 0)
        .slice(0, 5)
    : [];
  return {
    ...fallback,
    headline: (headlineMatch?.[1] ?? fallback.headline).trim(),
    summary: (summaryMatch?.[1] ?? fallback.summary).trim(),
    recommendations: recs.length > 0 ? recs : fallback.recommendations,
  };
}

/**
 * Generate a coaching summary using an LLM provider, with the rule engine as fallback.
 *
 * If the LLM call fails, the rule-engine output is returned (offline-safe).
 */
export async function generateCoachSummary(input: CoachInput, provider?: LLMProvider): Promise<CoachOutput> {
  const ruleOutput = ruleEngineSummary(input);
  if (!provider) return ruleOutput;
  try {
    const text = await provider.complete({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input, ruleOutput.analysis),
    });
    const parsed = parseLLMOutput(text, ruleOutput);
    return { ...parsed, source: provider.name };
  } catch {
    return ruleOutput;
  }
}

// ── LLM provider implementations ───────────────────────────────────────

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

function defaultFetch(): FetchLike {
  if (typeof globalThis.fetch !== 'function') {
    throw new HRKitError('@hrkit/coach: no global fetch — pass `fetch` in provider config.', 'MISSING_DEPENDENCY');
  }
  return globalThis.fetch as unknown as FetchLike;
}

/** OpenAI Chat Completions provider. */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private fetchFn: FetchLike;

  constructor(
    private config: {
      apiKey: string;
      model?: string;
      baseUrl?: string;
      fetch?: FetchLike;
    },
  ) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async complete(input: { system: string; user: string }): Promise<string> {
    const url = `${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new RequestError(`OpenAI HTTP ${res.status}`, { status: res.status });
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? '';
  }
}

/** Anthropic Messages API provider. */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private fetchFn: FetchLike;

  constructor(
    private config: {
      apiKey: string;
      model?: string;
      baseUrl?: string;
      fetch?: FetchLike;
    },
  ) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async complete(input: { system: string; user: string }): Promise<string> {
    const url = `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model ?? 'claude-3-5-haiku-latest',
        max_tokens: 400,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });
    if (!res.ok) throw new RequestError(`Anthropic HTTP ${res.status}`, { status: res.status });
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    return json.content?.[0]?.text ?? '';
  }
}

/** Ollama (local) provider. */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private fetchFn: FetchLike;

  constructor(
    private config: {
      model?: string;
      baseUrl?: string;
      fetch?: FetchLike;
    } = {},
  ) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async complete(input: { system: string; user: string }): Promise<string> {
    const url = `${this.config.baseUrl ?? 'http://localhost:11434'}/api/chat`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model ?? 'llama3.2',
        stream: false,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });
    if (!res.ok) throw new RequestError(`Ollama HTTP ${res.status}`, { status: res.status });
    const json = (await res.json()) as { message?: { content?: string } };
    return json.message?.content ?? '';
  }
}

// ── Live coaching utility ──────────────────────────────────────────────

/**
 * Real-time cue generator: returns a short verbal cue when the athlete drifts
 * out of a target zone. Useful for live audio coaching.
 */
export function liveCue(
  hr: number,
  targetZone: 1 | 2 | 3 | 4 | 5,
  config: { maxHR: number; restHR?: number; zones?: [number, number, number, number] },
): string | null {
  const zoneConfig = {
    maxHR: config.maxHR,
    restHR: config.restHR,
    zones: config.zones ?? [0.6, 0.7, 0.8, 0.9],
  };
  const current = hrToZone(hr, zoneConfig);
  if (current === targetZone) return null;
  if (current > targetZone) return 'Ease back — you are above target.';
  return 'Push it — you are below target.';
}

// ── Adaptive workout recommender ───────────────────────────────────────
export {
  evalRecommender,
  performanceRecommender,
  polarisedRecommender,
  type RecommenderEvalCase,
  type RecommenderEvalResult,
  type RecommenderPort,
  recoveryFirstRecommender,
  type WorkoutRecommendation,
} from './recommender.js';
/** Re-export rmssd convenience for consumers building their own coach. */
export { rmssd as sessionRmssd };
