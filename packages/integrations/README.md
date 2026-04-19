# @hrkit/integrations

Third-party integrations for @hrkit — FIT file export plus uploaders for Strava, Garmin Connect, TrainingPeaks, and Intervals.icu.

Part of the [@hrkit](https://github.com/josedab/hrkit) monorepo — a platform-agnostic TypeScript SDK for BLE heart-rate sensors.

## Install

```bash
npm install @hrkit/integrations
```

## Usage

```ts
import { sessionToFIT, StravaUploader } from '@hrkit/integrations';

const fitBytes = sessionToFIT(session);

const strava = new StravaUploader({ accessToken: process.env.STRAVA_TOKEN! });
const result = await strava.upload(session, {
  name: 'Morning ride',
  timeoutMs: 30_000,
});
console.log(result.id);
```

Every outbound HTTP request carries a `User-Agent: hrkit-integrations/<version>` header so partner services can identify SDK traffic.

## File formats & health stores

The package also exports format encoders that don't need network access — useful for offline workflows, manual sharing, or feeding sessions into HealthKit / Health Connect.

```ts
import {
  sessionToFIT,
  sessionToTCX,
  verifyFIT,
  sessionToHealthRecords,
  MemoryHealthStore,
} from '@hrkit/integrations';

// Binary FIT (Garmin-compatible). Optional sport metadata.
const fit = sessionToFIT(session, { sport: 'running', manufacturer: 255 });
const check = verifyFIT(fit);
if (!check.ok) console.warn('FIT verification failed:', check.reason);

// XML TCX — convenient for older platforms / manual upload.
const tcx = sessionToTCX(session, { sport: 'cycling' });

// Platform-agnostic health records (HR samples + a single workout summary).
const records = sessionToHealthRecords(session, { athleteId: 'me' });
const store = new MemoryHealthStore();
await store.requestAuthorization(['hr-sample', 'workout']);
await store.save(records);
```

`HealthStore` is the contract a real HealthKit / Health Connect adapter implements — `MemoryHealthStore` is the test double. Adapters for the platform stores live in their respective companion packages.

## Per-provider quickstart

### Strava

OAuth 2.0 — exchange the user's auth code for an access + refresh token through your backend, then hand the refresh hook to a `TokenProvider` so 401s self-heal.

```ts
import { StravaUploader, staticTokenProvider, type TokenProvider } from '@hrkit/integrations';

const tokens: TokenProvider = {
  getToken: () => store.get('strava.access'),
  refresh: async () => {
    const fresh = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: await store.get('strava.refresh'),
      }),
    }).then((r) => r.json());
    await store.set('strava.access', fresh.access_token);
    await store.set('strava.refresh', fresh.refresh_token);
    return fresh.access_token;
  },
};

const strava = new StravaUploader({ tokens });
const r = await strava.upload(session, { name: 'Morning ride', sport: 'cycling' });
if (r.status === 'uploaded') console.log(r.url);
```

> Quick prototypes can use `staticTokenProvider(token)` (or the deprecated `accessToken` field) — but expect a `code: 'auth'` failure once the token expires (~6 hours).

### Garmin Connect (partner-program)

Garmin's upload endpoint requires OAuth 1.0a request signing — hosted-key style. Implement `signHeaders(url, method)` against your partner credentials and pass it to the uploader; the SDK handles everything else.

```ts
import { GarminUploader } from '@hrkit/integrations';
import { signOAuth1 } from 'my-oauth1-helper';

const garmin = new GarminUploader({
  signHeaders: (url, method) => signOAuth1({
    url, method,
    consumerKey: GARMIN_CONSUMER_KEY,
    consumerSecret: GARMIN_CONSUMER_SECRET,
    token: userToken,
    tokenSecret: userTokenSecret,
  }),
});

const r = await garmin.upload(session, { sport: 'running' });
```

A 409 from Garmin means the activity is already uploaded — the SDK surfaces this as `status: 'duplicate'`.

### Intervals.icu

API-key authentication — simplest of the four. Find your athlete id and API key under *Settings → Developer*.

```ts
import { IntervalsIcuUploader } from '@hrkit/integrations';

const intervals = new IntervalsIcuUploader({
  athleteId: 'i12345',
  apiKey: process.env.INTERVALS_API_KEY!,
});

const r = await intervals.upload(session, { name: '5x5 @ FTP' });
```

### TrainingPeaks

OAuth 2.0 — same pattern as Strava. TrainingPeaks issues access tokens that last 24 hours, so a `TokenProvider` with a working `refresh()` is effectively required for any long-lived integration.

```ts
import { TrainingPeaksUploader, type TokenProvider } from '@hrkit/integrations';

const tokens: TokenProvider = {
  getToken: () => store.get('tp.access'),
  refresh: async () => { /* POST to /oauth/token with refresh_token grant */ return newToken; },
};

const tp = new TrainingPeaksUploader({ tokens });
await tp.upload(session, { name: 'Threshold work' });
```

> Use `baseUrl` to point at the TrainingPeaks sandbox during partner integration testing.

## Structured upload results

Every uploader returns the same `UploadResult` shape:

```ts
interface UploadResult {
  provider: string;                                    // 'strava' | 'garmin' | ...
  status: 'uploaded' | 'queued' | 'duplicate' | 'failed';
  id?: string;                                         // upstream activity id
  url?: string;                                        // user-facing link, when known
  code?: 'auth' | 'rate_limited' | 'server_error'      // stable failure taxonomy
       | 'client_error' | 'timeout' | 'aborted'
       | 'network' | (string & {});
  httpStatus?: number;                                 // upstream HTTP status
  requestId?: string;                                  // x-request-id / x-amzn-request-id
  retryAfterSeconds?: number;                          // honors Retry-After on 429
  error?: string;                                      // human-readable summary
}
```

Switch on `code`, not the message — strings are not stable across provider releases.

## Multi-provider fan-out

`uploadToAll` runs uploaders concurrently and returns a result per provider. Pair it with `summarizeUploads` for a one-line decision:

```ts
import { uploadToAll, summarizeUploads } from '@hrkit/integrations';

const results = await uploadToAll([strava, garmin, intervals], session);
const sum = summarizeUploads(results);

if (sum.failed === 0) {
  console.log('all uploaded:', sum.successProviders);
} else {
  console.warn('partial upload', sum.failedProviders);
  if (sum.worstRetryAfterSeconds) {
    await new Promise((r) => setTimeout(r, sum.worstRetryAfterSeconds! * 1000));
  }
}
```

`UploadSummary.byProvider['strava']` gives O(1) lookup of any individual result.

## Reliability

- **Retries** — 429/502/503/504 retried with exponential backoff + jitter. `Retry-After` honored. Override per-uploader via `retry: { maxRetries, baseDelayMs }`, or disable with `retry: false`.
- **Idempotency** — every `POST /uploads` includes a deterministic `Idempotency-Key` derived from the session, so retrying a duplicate request never double-creates an activity. HTTP `409` is surfaced as `status: 'duplicate'`.
- **Timeouts** — pass `timeoutMs` per call. Surfaces as `code: 'timeout'`.
- **Cancellation** — pass `signal: AbortSignal` per call. Surfaces as `code: 'aborted'`.
- **Token refresh** — supply `tokens: TokenProvider` instead of `accessToken`; the uploader transparently refreshes once on 401.

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/integrations/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
