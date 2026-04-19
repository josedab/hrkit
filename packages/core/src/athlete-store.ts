import { filterArtifacts } from './artifact-filter.js';
import { rmssd as computeRmssd } from './hrv.js';
import { trimp as computeTrimp } from './trimp.js';
import type { Session } from './types.js';

// ── Types ───────────────────────────────────────────────────────────────

/** Summary of a stored session (lightweight, without full sample data). */
export interface SessionSummary {
  /** Unique session identifier. */
  id: string;
  /** Session start timestamp. */
  startTime: number;
  /** Session end timestamp. */
  endTime: number;
  /** Duration in seconds. */
  durationSec: number;
  /** Mean heart rate. */
  meanHR: number;
  /** Max heart rate. */
  maxHR: number;
  /** TRIMP for this session. */
  trimp: number;
  /** Post-artifact-filter rMSSD (null if no RR data). */
  rmssd: number | null;
  /** Number of rounds. */
  roundCount: number;
  /** Activity type from metadata, if present. */
  activityType?: string;
}

/** A point in a training load trend. */
export interface TrainingLoadPoint {
  /** ISO date string. */
  date: string;
  /** Acute training load (7-day rolling sum of TRIMP). */
  atl: number;
  /** Chronic training load (28-day rolling sum of TRIMP / 4). */
  ctl: number;
  /** Acute:Chronic workload ratio. */
  acwr: number;
  /** Training stress balance (CTL - ATL). Positive = fresh, negative = fatigued. */
  tsb: number;
}

/** HRV trend data point. */
export interface HRVTrendPoint {
  /** ISO date string. */
  date: string;
  /** rMSSD value. */
  rmssd: number;
  /** 7-day rolling average rMSSD. */
  rollingAvg: number;
  /** Coefficient of variation (rolling window). */
  cv: number;
}

/** Interface for persistent athlete data storage. */
export interface AthleteStore {
  /** Save a completed session. Generates and stores a SessionSummary. Returns the session ID. */
  saveSession(session: Session): string;

  /** Get all session summaries, ordered by startTime descending. */
  getSessions(limit?: number): SessionSummary[];

  /**
   * Get session summaries whose `startTime` falls within `[from, to]` (inclusive).
   * Both bounds are timestamps in ms since epoch. Use `Number.NEGATIVE_INFINITY`
   * / `Number.POSITIVE_INFINITY` for half-open ranges.
   *
   * @returns Array sorted newest first.
   */
  getSessionsBetween(from: number, to: number): SessionSummary[];

  /** Get a specific session summary by ID. */
  getSession(id: string): SessionSummary | undefined;

  /** Delete a session by ID. Returns true if found and deleted. */
  deleteSession(id: string): boolean;

  /** Get HRV trend data for the given number of days (default 30). */
  getHRVTrend(days?: number): HRVTrendPoint[];

  /** Get training load trend for the given number of days (default 42). */
  getTrainingLoadTrend(days?: number): TrainingLoadPoint[];

  /** Get the athlete's current ACWR (Acute:Chronic Workload Ratio). */
  getCurrentACWR(): number | null;

  /** Get total number of stored sessions. */
  getSessionCount(): number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Convert a timestamp (ms) to an ISO date string (YYYY-MM-DD). */
function toDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return an array of date strings for the last `days` days ending today. */
function dateRange(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    result.push(toDateString(d.getTime()));
  }
  return result;
}

// ── InMemoryAthleteStore ────────────────────────────────────────────────

/**
 * In-memory implementation of AthleteStore.
 * Suitable for testing, short-lived apps, or as a base for persistent stores.
 */
export class InMemoryAthleteStore implements AthleteStore {
  private sessions: Map<string, SessionSummary> = new Map();
  private dailyTRIMP: Map<string, number> = new Map();
  private dailyRMSSD: Map<string, number[]> = new Map();

  /**
   * Save a completed session. Computes and stores a SessionSummary with
   * derived metrics (TRIMP, rMSSD, mean/max HR). Accumulates daily aggregates.
   *
   * @param session - The completed session to save.
   * @returns Generated unique session identifier.
   */
  saveSession(session: Session): string {
    const id = `session-${session.startTime}-${randomId()}`;

    const durationSec = (session.endTime - session.startTime) / 1000;

    // Single-pass over samples to avoid spread-arg RangeError on long sessions.
    let hrSum = 0;
    let maxHR = 0;
    for (const s of session.samples) {
      hrSum += s.hr;
      if (s.hr > maxHR) maxHR = s.hr;
    }
    const meanHR = session.samples.length > 0 ? hrSum / session.samples.length : 0;

    const trimpValue = computeTrimp(session.samples, {
      maxHR: session.config.maxHR,
      restHR: session.config.restHR ?? 60,
      sex: session.config.sex ?? 'neutral',
    });

    let rmssdValue: number | null = null;
    if (session.rrIntervals.length >= 2) {
      const { filtered } = filterArtifacts(session.rrIntervals);
      if (filtered.length >= 2) {
        rmssdValue = computeRmssd(filtered);
      }
    }

    const activityType = session.metadata?.activityType != null ? String(session.metadata.activityType) : undefined;

    const summary: SessionSummary = {
      id,
      startTime: session.startTime,
      endTime: session.endTime,
      durationSec,
      meanHR,
      maxHR,
      trimp: trimpValue,
      rmssd: rmssdValue,
      roundCount: session.rounds.length,
      activityType,
    };

    this.sessions.set(id, summary);

    // Accumulate daily TRIMP
    const dateKey = toDateString(session.startTime);
    this.dailyTRIMP.set(dateKey, (this.dailyTRIMP.get(dateKey) ?? 0) + trimpValue);

    // Accumulate daily rMSSD
    if (rmssdValue !== null) {
      const existing = this.dailyRMSSD.get(dateKey) ?? [];
      existing.push(rmssdValue);
      this.dailyRMSSD.set(dateKey, existing);
    }

    return id;
  }

  /**
   * Get all session summaries, ordered by startTime descending.
   *
   * @param limit - Optional maximum number of summaries to return.
   * @returns Array of {@link SessionSummary} sorted newest first.
   */
  getSessions(limit?: number): SessionSummary[] {
    const all = [...this.sessions.values()].sort((a, b) => b.startTime - a.startTime);
    return limit != null ? all.slice(0, limit) : all;
  }

  /**
   * Get session summaries whose `startTime` falls within `[from, to]` (inclusive).
   *
   * @param from - Lower bound (ms since epoch).
   * @param to - Upper bound (ms since epoch).
   * @returns Array sorted newest first.
   * @throws {RangeError} If `from > to` or either bound is `NaN`.
   */
  getSessionsBetween(from: number, to: number): SessionSummary[] {
    if (Number.isNaN(from) || Number.isNaN(to)) {
      throw new RangeError('getSessionsBetween: from/to must be finite numbers');
    }
    if (from > to) {
      throw new RangeError('getSessionsBetween: from must be <= to');
    }
    return [...this.sessions.values()]
      .filter((s) => s.startTime >= from && s.startTime <= to)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get a specific session summary by ID.
   *
   * @param id - Session identifier returned by `saveSession()`.
   * @returns The {@link SessionSummary}, or `undefined` if not found.
   */
  getSession(id: string): SessionSummary | undefined {
    return this.sessions.get(id);
  }

  /**
   * Delete a session by ID.
   *
   * @param id - Session identifier.
   * @returns `true` if the session was found and deleted.
   */
  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * Get total number of stored sessions.
   *
   * @returns Count of stored sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get HRV trend data for the given number of days.
   * Computes daily rMSSD, 7-day rolling average, and coefficient of variation.
   *
   * @param days - Number of days to include. Default: 30.
   * @returns Array of {@link HRVTrendPoint} for days that have rMSSD data.
   */
  getHRVTrend(days: number = 30): HRVTrendPoint[] {
    const dates = dateRange(days);
    const points: HRVTrendPoint[] = [];

    for (const date of dates) {
      const values = this.dailyRMSSD.get(date);
      if (!values || values.length === 0) continue;

      const dayMean = values.reduce((s, v) => s + v, 0) / values.length;

      // Collect last 7 days of rMSSD values for rolling stats
      const windowValues: number[] = [];
      for (let d = 6; d >= 0; d--) {
        const windowDate = offsetDate(date, -d);
        const wv = this.dailyRMSSD.get(windowDate);
        if (wv && wv.length > 0) {
          windowValues.push(wv.reduce((s, v) => s + v, 0) / wv.length);
        }
      }

      const rollingAvg =
        windowValues.length > 0 ? windowValues.reduce((s, v) => s + v, 0) / windowValues.length : dayMean;

      let cv = 0;
      if (windowValues.length > 1 && rollingAvg > 0) {
        const variance = windowValues.reduce((s, v) => s + (v - rollingAvg) ** 2, 0) / windowValues.length;
        cv = Math.sqrt(variance) / rollingAvg;
      }

      points.push({ date, rmssd: dayMean, rollingAvg, cv });
    }

    return points;
  }

  /**
   * Get training load trend for the given number of days.
   * Computes ATL (7-day), CTL (28-day), ACWR, and TSB for each day.
   *
   * @param days - Number of days to include. Default: 42.
   * @returns Array of {@link TrainingLoadPoint} for each day in the range.
   */
  getTrainingLoadTrend(days: number = 42): TrainingLoadPoint[] {
    const dates = dateRange(days);
    const points: TrainingLoadPoint[] = [];

    for (const date of dates) {
      let atl = 0;
      for (let d = 0; d < 7; d++) {
        const key = offsetDate(date, -d);
        atl += this.dailyTRIMP.get(key) ?? 0;
      }

      let ctl28 = 0;
      for (let d = 0; d < 28; d++) {
        const key = offsetDate(date, -d);
        ctl28 += this.dailyTRIMP.get(key) ?? 0;
      }
      const ctl = ctl28 / 4;

      const acwr = ctl > 0 ? atl / ctl : 0;
      const tsb = ctl - atl;

      points.push({ date, atl, ctl, acwr, tsb });
    }

    return points;
  }

  /**
   * Get the athlete's current ACWR (Acute:Chronic Workload Ratio).
   *
   * @returns Current ACWR value, or `null` if no chronic training data exists
   *   (i.e. CTL is zero — there's no baseline to compute the ratio against).
   */
  getCurrentACWR(): number | null {
    if (this.dailyTRIMP.size === 0) return null;

    const today = toDateString(Date.now());

    let atl = 0;
    for (let d = 0; d < 7; d++) {
      atl += this.dailyTRIMP.get(offsetDate(today, -d)) ?? 0;
    }

    let ctl28 = 0;
    for (let d = 0; d < 28; d++) {
      ctl28 += this.dailyTRIMP.get(offsetDate(today, -d)) ?? 0;
    }
    const ctl = ctl28 / 4;

    // Without chronic baseline, ACWR is undefined — surface as null so consumers
    // can distinguish "no data" from "zero ratio".
    return ctl > 0 ? atl / ctl : null;
  }
}

/** Offset a YYYY-MM-DD date string by `offsetDays` days. */
function offsetDate(dateStr: string, offsetDays: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  return toDateString(d.getTime());
}

/**
 * Generate a short collision-resistant ID.
 * Prefers `crypto.randomUUID()` (Node 14.17+, modern browsers) and falls back
 * to a Math.random() segment in environments that lack Web Crypto.
 */
function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    // Take first segment for readability; UUIDs are unique even with truncation
    // collisions vanishingly improbable for any single store.
    return c.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
