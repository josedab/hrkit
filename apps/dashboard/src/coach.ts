/**
 * Coach Mode helpers — alert evaluation, roster persistence, and snapshot
 * exports. Pure functions / DOM-free utilities so they can be unit-tested in
 * a Node environment.
 */

export interface AlertRule {
  type: 'hr_above' | 'hr_below' | 'in_zone';
  threshold: number;
  /** For `in_zone`, the zone index (1–5). */
  zone?: number;
  /** Minimum sustained duration (ms) before firing. */
  sustainMs?: number;
}

export interface AlertState {
  /** Last sample HR. */
  hr?: number;
  /** Last evaluation time. */
  at: number;
  /** When the rule first started matching (null = not currently matching). */
  matchedSince: number | null;
  /** When the rule last fired (debounced). */
  lastFiredAt: number | null;
}

export interface AlertEvent {
  rule: AlertRule;
  at: number;
  hr: number;
}

/** Stateless single-rule evaluation. Returns an event when the rule fires. */
export function evaluateRule(
  rule: AlertRule,
  hr: number,
  zone: number | undefined,
  state: AlertState,
  now: number,
  cooldownMs = 30_000,
): AlertEvent | null {
  let matches = false;
  if (rule.type === 'hr_above') matches = hr > rule.threshold;
  else if (rule.type === 'hr_below') matches = hr < rule.threshold;
  else if (rule.type === 'in_zone') matches = zone === rule.zone;

  if (matches) {
    if (state.matchedSince === null) state.matchedSince = now;
  } else {
    state.matchedSince = null;
  }
  state.hr = hr;
  state.at = now;

  const sustained = state.matchedSince !== null && now - state.matchedSince >= (rule.sustainMs ?? 0);
  const cooledDown = state.lastFiredAt === null || now - state.lastFiredAt >= cooldownMs;
  if (sustained && cooledDown) {
    state.lastFiredAt = now;
    return { rule, at: now, hr };
  }
  return null;
}

/** Roster row persisted in localStorage. */
export interface RosterAthlete {
  id: string;
  name: string;
  maxHr?: number;
  restHr?: number;
  /** Hex color for the dashboard accent. */
  color?: string;
  rules?: AlertRule[];
}

export interface RosterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ROSTER_KEY = 'hrkit:dashboard:roster:v1';

export function loadRoster(storage: RosterStorage): RosterAthlete[] {
  const raw = storage.getItem(ROSTER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is RosterAthlete => a && typeof a === 'object' && typeof a.id === 'string' && typeof a.name === 'string',
    );
  } catch {
    return [];
  }
}

export function saveRoster(storage: RosterStorage, roster: RosterAthlete[]): void {
  storage.setItem(ROSTER_KEY, JSON.stringify(roster));
}

export function upsertAthlete(roster: RosterAthlete[], athlete: RosterAthlete): RosterAthlete[] {
  const idx = roster.findIndex((a) => a.id === athlete.id);
  if (idx === -1) return [...roster, athlete];
  const next = roster.slice();
  next[idx] = athlete;
  return next;
}

export function removeAthlete(roster: RosterAthlete[], id: string): RosterAthlete[] {
  return roster.filter((a) => a.id !== id);
}

export interface FrameForExport {
  athleteId: string;
  name?: string;
  hr: number;
  zone?: number;
  rmssd?: number;
  atl?: number;
}

/** CSV snapshot of the current roster state. Columns mirror dashboard cards. */
export function rosterCsv(frames: FrameForExport[]): string {
  const header = 'athlete_id,name,hr,zone,rmssd,atl';
  const rows = frames.map((f) =>
    [f.athleteId, f.name ?? '', f.hr, f.zone ?? '', f.rmssd?.toFixed(1) ?? '', f.atl?.toFixed(1) ?? '']
      .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : String(v)))
      .join(','),
  );
  return [header, ...rows].join('\n');
}
