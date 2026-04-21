# ADR 0011: Silent-by-Default Logger with Mandatory Redaction

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

An SDK logging to the console by default is a common source of
complaints — it pollutes app output, leaks sensitive data (API keys,
device IDs, tokens), and cannot be silenced without SDK-specific
configuration.

At the same time, SDK developers need debug output during development,
and production systems need structured logs routed to observability
backends (Datadog, Sentry, pino, winston).

Heart rate and health data is sensitive. BLE device identifiers, API
keys for Strava/Garmin integrations, and signed URLs must never appear
in logs — even during development.

## Decision

The logging system in `packages/core/src/logger.ts` follows three rules:

### 1. Silent by default

```ts
let activeLogger: Logger = NoopLogger;
```

The SDK ships with `NoopLogger` (all methods are no-ops). No output
is emitted until the consumer explicitly calls `setLogger(logger)`.
This means:

- Production apps see zero SDK console output by default.
- Consumers opt in to logging, not opt out.

### 2. Pluggable interface

```ts
interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
```

Consumers implement 4 methods to wire any backend. A `ConsoleLogger`
is provided for development. The logger is global (set once at startup).

### 3. Mandatory PII redaction

Every log path routes metadata through `redact()` before emission.
The redactor detects secrets by:

- **Key matching**: regex pattern covering `token`, `secret`,
  `password`, `api_key`, `authorization`, `bearer`, `cookie`, etc.
- **Value matching**: detects `Bearer ...` and `Basic ...` tokens
  regardless of key name.
- **Inline matching**: regex replacement for `authorization=value`,
  `api_key=value`, `token=value` embedded in strings.
- **Cyclic reference protection**: `WeakSet`-based cycle detection
  prevents infinite loops on self-referencing objects.

Redacted values are replaced with the constant `'[REDACTED]'`.

Even the built-in `ConsoleLogger` applies redaction automatically.

## Consequences

### Positive

- Zero log noise in production by default — no customer complaints
  about SDK console spam.
- PII/secret leakage is structurally prevented: redaction runs on every
  log path, including debug. Developers can't accidentally log an API
  key even during development.
- Any logging backend works — pino, winston, Sentry, custom.
- `REDACTED` constant is exported for consumers to use in their own
  logging.

### Negative

- Silent-by-default means new users don't see diagnostics when things
  go wrong. They must know to call `setLogger(ConsoleLogger)`.
  Mitigated by documentation and the CONTRIBUTING.md guide.
- Global logger means it cannot be scoped per-module or per-session.
  This is intentional (simplicity over flexibility) but means a
  multi-tenant server can't log different sessions to different
  destinations.
- Redaction has a performance cost (regex matching on every log call).
  Acceptable because logging is not on the hot path (HR packet
  processing does not log).

## Alternatives Considered

1. **Console logging by default** — rejected: creates noise in
   production apps and risks PII leakage.

2. **`debug`-style environment variable** (`DEBUG=hrkit:*`) — rejected:
   not available in all runtimes (Web, Workers), and doesn't solve
   the PII problem.

3. **Structured logging with levels as numbers** — rejected: adds
   complexity. String levels (`'debug'`, `'info'`) are simpler and
   match the pino/winston convention.

4. **Per-module loggers** (`getLogger('session-recorder')`) — rejected
   for v1: premature complexity. The single global logger covers all
   current use cases. Can be added later without breaking changes.

## References

- Source: `packages/core/src/logger.ts`
- Tests: `packages/core/src/__tests__/logger.test.ts`
- Security guidance: `SECURITY.md` line 28
- Consumer guide: `CONTRIBUTING.md` → "Debugging"
