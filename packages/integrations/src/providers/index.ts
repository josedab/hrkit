import type { Session } from '@hrkit/core';
import { base64EncodeString } from '../base64.js';
import { type FitEncodeOptions, sessionToFIT } from '../fit.js';

/**
 * Minimal fetch-compatible signature so consumers can inject their HTTP layer
 * (browser fetch, undici, node-fetch, edge runtime fetch).
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | string | Uint8Array;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface SessionUploader {
  readonly name: string;
  upload(session: Session, options?: UploadOptions): Promise<UploadResult>;
}

export interface UploadOptions {
  name?: string;
  description?: string;
  sport?: FitEncodeOptions['sport'];
  private?: boolean;
}

export interface UploadResult {
  provider: string;
  id?: string;
  status: 'uploaded' | 'queued' | 'duplicate' | 'failed';
  url?: string;
  raw?: unknown;
  error?: string;
}

interface BaseConfig {
  accessToken: string;
  fetch?: FetchLike;
}

function defaultFetch(): FetchLike {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error(
      '@hrkit/integrations: no global fetch found. Pass `fetch` in the provider config (e.g., undici, node-fetch).',
    );
  }
  return globalThis.fetch as unknown as FetchLike;
}

// ── Strava ──────────────────────────────────────────────────────────────

/**
 * Strava uploader: posts FIT to `POST /api/v3/uploads`.
 * @see https://developers.strava.com/docs/uploads/
 */
export class StravaUploader implements SessionUploader {
  readonly name = 'strava';
  private fetchFn: FetchLike;

  constructor(private config: BaseConfig) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const boundary = `----hrkit${Math.random().toString(16).slice(2)}`;
    const body = buildMultipart(boundary, [
      { name: 'data_type', value: 'fit' },
      ...(options?.name ? [{ name: 'name', value: options.name }] : []),
      ...(options?.description ? [{ name: 'description', value: options.description }] : []),
      ...(options?.private ? [{ name: 'private', value: '1' }] : []),
      { name: 'file', filename: 'activity.fit', contentType: 'application/octet-stream', value: fitBytes },
    ]);

    try {
      const res = await this.fetchFn('https://www.strava.com/api/v3/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: number;
        id_str?: string;
        status?: string;
        error?: string;
        activity_id?: number;
      };
      if (!res.ok) {
        return { provider: this.name, status: 'failed', error: json.error ?? `HTTP ${res.status}`, raw: json };
      }
      if (json.error) {
        const dup = json.error.toLowerCase().includes('duplicate');
        return { provider: this.name, status: dup ? 'duplicate' : 'failed', error: json.error, raw: json };
      }
      const uploadId = json.id_str ?? (json.id !== undefined ? String(json.id) : undefined);
      const activityId = json.activity_id !== undefined ? String(json.activity_id) : undefined;
      return {
        provider: this.name,
        status: activityId ? 'uploaded' : 'queued',
        id: activityId ?? uploadId,
        url: activityId ? `https://www.strava.com/activities/${activityId}` : undefined,
        raw: json,
      };
    } catch (err) {
      return { provider: this.name, status: 'failed', error: (err as Error).message };
    }
  }
}

// ── Intervals.icu ───────────────────────────────────────────────────────

export class IntervalsIcuUploader implements SessionUploader {
  readonly name = 'intervals.icu';
  private fetchFn: FetchLike;

  constructor(private config: { apiKey: string; athleteId: string; fetch?: FetchLike }) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const boundary = `----hrkit${Math.random().toString(16).slice(2)}`;
    const body = buildMultipart(boundary, [
      ...(options?.name ? [{ name: 'name', value: options.name }] : []),
      ...(options?.description ? [{ name: 'description', value: options.description }] : []),
      { name: 'file', filename: 'activity.fit', contentType: 'application/octet-stream', value: fitBytes },
    ]);

    const auth =
      typeof globalThis.btoa === 'function'
        ? globalThis.btoa(`API_KEY:${this.config.apiKey}`)
        : base64EncodeString(`API_KEY:${this.config.apiKey}`);

    try {
      const res = await this.fetchFn(
        `https://intervals.icu/api/v1/athlete/${encodeURIComponent(this.config.athleteId)}/activities`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        },
      );
      const text = await res.text();
      let json: { id?: string; error?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }
      if (!res.ok) {
        return { provider: this.name, status: 'failed', error: json.error ?? `HTTP ${res.status}`, raw: text };
      }
      return {
        provider: this.name,
        status: 'uploaded',
        id: json.id,
        url: json.id ? `https://intervals.icu/activities/${json.id}` : undefined,
        raw: json,
      };
    } catch (err) {
      return { provider: this.name, status: 'failed', error: (err as Error).message };
    }
  }
}

// ── Garmin Connect ─────────────────────────────────────────────────────

/**
 * Garmin Connect uploader. Requires OAuth1-signed headers — inject via `signHeaders`.
 * @see https://developer.garmin.com/gc-developer-program/activity-api/
 */
export class GarminUploader implements SessionUploader {
  readonly name = 'garmin';
  private fetchFn: FetchLike;

  constructor(
    private config: {
      signHeaders: (url: string, method: string) => Record<string, string> | Promise<Record<string, string>>;
      baseUrl?: string;
      fetch?: FetchLike;
    },
  ) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const url = `${this.config.baseUrl ?? 'https://connectapi.garmin.com'}/activity-service/activity/fit`;
    try {
      const headers = await this.config.signHeaders(url, 'POST');
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', ...headers },
        body: fitBytes,
      });
      const text = await res.text();
      if (!res.ok) {
        return { provider: this.name, status: 'failed', error: `HTTP ${res.status}: ${text}`, raw: text };
      }
      let json: { activityId?: string; detailedImportResult?: { uploadId?: string } } = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      const id = json.activityId ?? json.detailedImportResult?.uploadId;
      return {
        provider: this.name,
        status: id ? 'uploaded' : 'queued',
        id,
        url: id ? `https://connect.garmin.com/modern/activity/${id}` : undefined,
        raw: json,
      };
    } catch (err) {
      return { provider: this.name, status: 'failed', error: (err as Error).message };
    }
  }

  static isDuplicateResponse(status: number): boolean {
    return status === 409;
  }
}

// ── TrainingPeaks ──────────────────────────────────────────────────────

export class TrainingPeaksUploader implements SessionUploader {
  readonly name = 'trainingpeaks';
  private fetchFn: FetchLike;

  constructor(private config: BaseConfig & { baseUrl?: string }) {
    this.fetchFn = config.fetch ?? defaultFetch();
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const url = `${this.config.baseUrl ?? 'https://api.trainingpeaks.com'}/v2/file`;
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/octet-stream',
          ...(options?.name ? { 'X-File-Name': options.name } : {}),
        },
        body: fitBytes,
      });
      const text = await res.text();
      if (!res.ok) {
        return { provider: this.name, status: 'failed', error: `HTTP ${res.status}: ${text}`, raw: text };
      }
      let json: { workoutId?: string; id?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      const id = json.workoutId ?? json.id;
      return { provider: this.name, status: 'uploaded', id, raw: json };
    } catch (err) {
      return { provider: this.name, status: 'failed', error: (err as Error).message };
    }
  }
}

// ── Multipart helper ───────────────────────────────────────────────────

interface FormPart {
  name: string;
  value: string | Uint8Array;
  filename?: string;
  contentType?: string;
}

function buildMultipart(boundary: string, parts: FormPart[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(enc.encode(header));
    chunks.push(typeof part.value === 'string' ? enc.encode(part.value) : part.value);
    chunks.push(enc.encode('\r\n'));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Upload to multiple providers in parallel. */
export async function uploadToAll(
  uploaders: SessionUploader[],
  session: Session,
  options?: UploadOptions,
): Promise<UploadResult[]> {
  return Promise.all(uploaders.map((u) => u.upload(session, options)));
}
