# ADR 0007: Structured Error Hierarchy

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

An SDK that spans BLE parsing, network connections, HTTP uploads, and
input validation produces many different failure modes. Consumers need
to distinguish between retryable transient failures (BLE disconnect,
rate limit) and permanent ones (invalid data, auth failure) so they can
build robust retry and fallback logic.

Throwing bare `Error` objects forces consumers into fragile string
matching. A flat set of named error classes lacks the ability to catch
all SDK errors in a single `catch` clause.

## Decision

We define a rooted error hierarchy in `packages/core/src/errors.ts`:

```
HRKitError (base)
├── ParseError          — invalid BLE data (truncated, wrong format)
├── ConnectionError     — BLE connection failure
├── TimeoutError        — scan or connection timeout
├── DeviceNotFoundError — no compatible device in range
├── ValidationError     — invalid input (config, packet, session)
└── RequestError        — HTTP error (non-transient 4xx)
    ├── AuthError       — 401/403
    ├── RateLimitError  — 429, carries retryAfterSeconds
    └── ServerError     — 5xx
```

Each error carries:

- `code: string` — machine-readable error code (e.g., `'PARSE_ERROR'`)
- Subclass-specific fields (`status`, `requestId`, `retryAfterSeconds`,
  `errors[]`, `warnings[]`)

An `isRetryable(err)` helper encodes the retry policy:
- `RateLimitError`, `ServerError`, `TimeoutError` → retryable
- `AuthError`, `ValidationError` → not retryable
- Unknown errors → assume retryable (conservative for network errors)

A `formatError(err)` helper produces stable single-line log strings.

## Consequences

### Positive

- `catch (e) { if (e instanceof HRKitError) ... }` catches all SDK
  errors without coupling to message strings.
- `isRetryable()` gives consumers a ready-made policy — no need to
  duplicate retry heuristics.
- Machine-readable `code` field enables error tracking and analytics
  without parsing messages.
- HTTP errors carry `requestId` for correlation with server-side logs.

### Negative

- Extending the hierarchy (e.g., adding `BluetoothPermissionError`)
  requires a semver-minor release since consumers may be matching on
  `instanceof`.
- `isRetryable()` is opinionated — consumers with different retry
  semantics must override it.

## Alternatives Considered

1. **Error codes as enums** (no class hierarchy) — rejected: loses
   `instanceof` ergonomics and TypeScript narrowing.

2. **Single `HRKitError` with `kind` discriminator** — rejected: would
   require consumers to switch on a string instead of catching specific
   types; also can't carry subclass-specific fields without type guards.

3. **Result types (`{ ok, error }`)** — rejected: would change every
   public function signature and is non-idiomatic for an SDK that deals
   with async I/O (promises + throw is the standard pattern).

## References

- Source: `packages/core/src/errors.ts`
- Tests: `packages/core/src/__tests__/errors.test.ts`
- Retry utility: `packages/core/src/retry.ts` (uses `isRetryable`)
- Consumer example: `packages/integrations/src/providers/index.ts`
