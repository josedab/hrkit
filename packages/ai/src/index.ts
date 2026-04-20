export { SDK_NAME, SDK_VERSION } from './version.js';

import type { LLMProvider } from '@hrkit/coach';
import type { AthleteStore, HRVTrendPoint, SessionSummary, TrainingLoadPoint, WorkoutProtocol } from '@hrkit/core';
import { parseWorkoutDSL } from '@hrkit/core';

// ── Tool layer ──────────────────────────────────────────────────────────

/**
 * Tools the agent may call. Each tool is a pure function over an AthleteStore;
 * the agent never touches the store directly.
 */
export interface PlannerTools {
  getRecentSessions(limit: number): SessionSummary[];
  getHRVTrend(days: number): HRVTrendPoint[];
  getTrainingLoad(days: number): TrainingLoadPoint[];
}

export function makeTools(store: AthleteStore): PlannerTools {
  return {
    getRecentSessions: (limit) => store.getSessions(Math.max(1, Math.min(50, limit))),
    getHRVTrend: (days) => store.getHRVTrend(Math.max(1, Math.min(180, days))),
    getTrainingLoad: (days) => store.getTrainingLoadTrend(Math.max(1, Math.min(180, days))),
  };
}

// ── Snapshot for LLM prompt ─────────────────────────────────────────────

export interface AthleteSnapshot {
  recentSessions: SessionSummary[];
  hrvTrend: HRVTrendPoint[];
  load: TrainingLoadPoint[];
  rmssdBaseline: number | null;
  acwr: number | null;
  weekTRIMP: number;
}

export function buildSnapshot(tools: PlannerTools, opts: { window?: number } = {}): AthleteSnapshot {
  const days = opts.window ?? 28;
  const sessions = tools.getRecentSessions(20);
  const hrv = tools.getHRVTrend(days);
  const load = tools.getTrainingLoad(days);

  const rmssdBaseline = hrv.length === 0 ? null : hrv.reduce((s, p) => s + p.rmssd, 0) / hrv.length;

  const last7 = load.slice(-7);
  const acute = last7.length === 0 ? 0 : last7.reduce((s, p) => s + p.atl, 0) / last7.length;
  const last28 = load.slice(-28);
  const chronic = last28.length === 0 ? 0 : last28.reduce((s, p) => s + p.ctl, 0) / last28.length;
  const acwr = chronic === 0 ? null : acute / chronic;

  const weekTRIMP = sessions
    .filter((s) => s.startTime >= Date.now() - 7 * 86400000)
    .reduce((sum, s) => sum + (s.trimp ?? 0), 0);

  return { recentSessions: sessions, hrvTrend: hrv, load, rmssdBaseline, acwr, weekTRIMP };
}

// ── Planner ─────────────────────────────────────────────────────────────

export interface PlannerInput {
  store: AthleteStore;
  goal: string;
  daysAhead?: number;
  llm: LLMProvider;
  guardrails?: PlanGuardrails;
}

export interface PlanGuardrails {
  /** Max minutes of zone-5 work per session. Default: 12. */
  maxZ5MinutesPerSession?: number;
  /** Max sessions per planning window. Default: 6. */
  maxSessionsPerWeek?: number;
  /** Hard floor on rest seconds after a zone-4+ effort. Default: 30. */
  minRestSeconds?: number;
}

export interface PlannedSession {
  day: number;
  rationale: string;
  dsl: string;
  protocol: WorkoutProtocol;
}

export interface PlannerOutput {
  goal: string;
  snapshot: AthleteSnapshot;
  sessions: PlannedSession[];
  warnings: string[];
}

const DEFAULT_GUARDRAILS: Required<PlanGuardrails> = {
  maxZ5MinutesPerSession: 12,
  maxSessionsPerWeek: 6,
  minRestSeconds: 30,
};

const SYSTEM_PROMPT = `You are an evidence-based endurance and strength-conditioning coach.
You will be given an athlete's recent training history and asked to plan upcoming days.
Respond with a JSON array of objects: [{"day": 1, "rationale": "...", "dsl": "name: ...\\n..."}].
Each "dsl" must be a valid hrkit Workout DSL block.
Keep weekly load similar to the prior week unless the user explicitly says to ramp.
Output ONLY the JSON array, no code fences, no commentary.`;

function trySplitJSON(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function applyGuardrails(p: WorkoutProtocol, g: Required<PlanGuardrails>): string[] {
  const warnings: string[] = [];
  let z5seconds = 0;
  for (let i = 0; i < p.steps.length; i++) {
    const step = p.steps[i]!;
    if (step.target?.zone === 5 && step.type !== 'rest') z5seconds += step.durationSec;
    if (step.type === 'rest' && step.durationSec < g.minRestSeconds) {
      const prev = p.steps[i - 1];
      if (prev?.target?.zone && prev.target.zone >= 4) {
        warnings.push(`rest after high-intensity step is below ${g.minRestSeconds}s`);
      }
    }
  }
  if (z5seconds > g.maxZ5MinutesPerSession * 60) {
    warnings.push(`zone-5 volume exceeds guardrail (${Math.round(z5seconds / 60)}m > ${g.maxZ5MinutesPerSession}m)`);
  }
  return warnings;
}

/**
 * Plan the next N days of training. Single-shot — fetches a snapshot, asks the
 * LLM, validates each emitted DSL by parsing it, applies guardrails. Soft
 * violations are returned as warnings; only structural failures throw.
 */
export async function planNextWeek(input: PlannerInput): Promise<PlannerOutput> {
  const days = input.daysAhead ?? 7;
  const guardrails = { ...DEFAULT_GUARDRAILS, ...(input.guardrails ?? {}) };
  const tools = makeTools(input.store);
  const snapshot = buildSnapshot(tools);

  const userPrompt = `Goal: ${input.goal}
Days to plan: ${days}
Guardrails: max ${guardrails.maxZ5MinutesPerSession} min Z5/session, max ${guardrails.maxSessionsPerWeek} sessions/week.

ATHLETE SNAPSHOT:
- rMSSD baseline: ${snapshot.rmssdBaseline?.toFixed(1) ?? 'n/a'} ms
- ACWR: ${snapshot.acwr?.toFixed(2) ?? 'n/a'}
- Week TRIMP: ${snapshot.weekTRIMP.toFixed(0)}
- Recent sessions (last ${snapshot.recentSessions.length}):
${snapshot.recentSessions
  .slice(0, 7)
  .map(
    (s) =>
      `  - ${new Date(s.startTime).toISOString().slice(0, 10)}  duration=${Math.round(s.durationSec / 60)}m  trimp=${(s.trimp ?? 0).toFixed(0)}  activity=${s.activityType ?? '?'}`,
  )
  .join('\n')}

Plan the next ${days} days. Vary intensity. Include at least one full rest day if days >= 5.`;

  const raw = await input.llm.complete({ system: SYSTEM_PROMPT, user: userPrompt });
  const json = trySplitJSON(raw);
  if (!json) throw new Error(`AI response not parseable as JSON array: ${raw.slice(0, 200)}`);

  let parsed: Array<{ day: number; rationale?: string; dsl: string }>;
  try {
    parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('not an array');
  } catch (err) {
    throw new Error(`AI JSON parse failed: ${(err as Error).message}`);
  }

  const sessions: PlannedSession[] = [];
  const warnings: string[] = [];
  for (const item of parsed) {
    if (typeof item.day !== 'number' || typeof item.dsl !== 'string') {
      warnings.push(`skipped invalid item: ${JSON.stringify(item).slice(0, 80)}`);
      continue;
    }
    try {
      const protocol = parseWorkoutDSL(item.dsl);
      const w = applyGuardrails(protocol, guardrails);
      warnings.push(...w.map((m) => `day ${item.day}: ${m}`));
      sessions.push({ day: item.day, rationale: item.rationale ?? '', dsl: item.dsl, protocol });
    } catch (err) {
      warnings.push(`day ${item.day}: DSL parse failed (${(err as Error).message})`);
    }
  }

  if (sessions.length > guardrails.maxSessionsPerWeek) {
    warnings.push(`plan exceeds ${guardrails.maxSessionsPerWeek} sessions/week guardrail`);
  }

  return { goal: input.goal, snapshot, sessions, warnings };
}
