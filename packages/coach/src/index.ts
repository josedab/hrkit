import { analyzeSession, hrToZone, rmssd, type Session, type SessionAnalysis } from '@hrkit/core';

// ── Public types ────────────────────────────────────────────────────────

export interface CoachInput {
  /** The session to analyze. */
  session: Session;
  /** Optional baseline rMSSD (ms) — enables recovery commentary. */
  baselineRmssd?: number;
  /** Optional list of recent training-load values for ACWR-aware advice. */
  recentTrimps?: number[];
  /** Optional context the user types in ("how do I feel today"). */
  userNote?: string;
}

export interface CoachOutput {
  /** One-line summary suitable for a notification. */
  headline: string;
  /** 3–6 sentence narrative summary. */
  summary: string;
  /** Up to 5 short bullet recommendations. */
  recommendations: string[];
  /** Top dominant zone (1–5). */
  dominantZone: 1 | 2 | 3 | 4 | 5;
  /** Numerical analysis embedded for downstream use. */
  analysis: SessionAnalysis;
  /** Source: 'rule-engine' or LLM provider name. */
  source: string;
}

/** Provider-agnostic LLM interface. Implementations call OpenAI/Anthropic/Ollama. */
export interface LLMProvider {
  readonly name: string;
  /** Complete a chat-style prompt; returns the assistant's text response. */
  complete(input: { system: string; user: string }): Promise<string>;
}

// ── Deterministic rule engine ──────────────────────────────────────────

/**
 * Generate a coaching summary purely from rules — no network, no LLM.
 * Always returns a sensible, conservative response.
 */
export function ruleEngineSummary(input: CoachInput): CoachOutput {
  const { session, baselineRmssd, recentTrimps } = input;
  const analysis = analyzeSession(session);
  const zones = analysis.zones.zones;
  const dominantZoneStr = Object.entries(zones).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '1';
  const dominantZone = Number.parseInt(dominantZoneStr, 10) as 1 | 2 | 3 | 4 | 5;

  const totalSec = analysis.zones.total;
  const minutes = Math.round(totalSec / 60);
  const trimp = analysis.trimp;

  const intensity = trimp < 30 ? 'easy' : trimp < 80 ? 'moderate' : trimp < 150 ? 'hard' : 'very hard';

  // Recovery signal
  let recovery = '';
  if (analysis.hrv && baselineRmssd && baselineRmssd > 0) {
    const ratio = analysis.hrv.rmssd / baselineRmssd;
    if (ratio >= 0.95) recovery = 'HRV is at or above your baseline — recovery looks strong.';
    else if (ratio >= 0.8) recovery = 'HRV is slightly below baseline — moderate sessions only today.';
    else recovery = 'HRV is well below baseline — prioritise rest or very easy aerobic work.';
  }

  // Load context (Acute load only — proper ACWR needs 4 weeks)
  let loadContext = '';
  if (recentTrimps && recentTrimps.length > 0) {
    const avg = recentTrimps.reduce((s, v) => s + v, 0) / recentTrimps.length;
    if (trimp > avg * 1.5) loadContext = 'This session is significantly harder than your recent average.';
    else if (trimp < avg * 0.5) loadContext = 'A lighter session compared to your recent average — good for recovery.';
  }

  const headline = `${minutes}-min ${intensity} session · TRIMP ${Math.round(trimp)}`;

  const summary = [
    `You logged ${minutes} minutes with an average HR around zone ${dominantZone}.`,
    `Training impulse came in at ${Math.round(trimp)}, which counts as ${intensity}.`,
    analysis.hrv ? `Session HRV (rMSSD) was ${Math.round(analysis.hrv.rmssd)} ms.` : '',
    recovery,
    loadContext,
  ]
    .filter(Boolean)
    .join(' ');

  const recommendations: string[] = [];
  if (intensity === 'very hard' && (!recovery || recovery.includes('below'))) {
    recommendations.push('Keep tomorrow easy or take a rest day.');
  }
  if (zones[5] > totalSec * 0.3) {
    recommendations.push('Consider keeping zone 5 work to <20% of total time to reduce overtraining risk.');
  }
  if (zones[1] + zones[2] < totalSec * 0.5 && intensity !== 'easy') {
    recommendations.push('Add more zone 1–2 volume across the week to build aerobic base.');
  }
  if (analysis.artifacts && analysis.artifacts.artifactRate > 0.1) {
    recommendations.push('Artifact rate is high — check sensor contact / strap moisture.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Solid session. Stay consistent and protect your easy days.');
  }

  return {
    headline,
    summary,
    recommendations: recommendations.slice(0, 5),
    dominantZone,
    analysis,
    source: 'rule-engine',
  };
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
    throw new Error('@hrkit/coach: no global fetch — pass `fetch` in provider config.');
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
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
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
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
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
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
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

/** Re-export rmssd convenience for consumers building their own coach. */
export { rmssd as sessionRmssd };
