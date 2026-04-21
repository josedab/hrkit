---
title: "@hrkit/otel"
description: "OpenTelemetry-compatible instrumentation hooks for @hrkit transports and sessions."
---

# @hrkit/otel

OpenTelemetry-compatible instrumentation hooks for @hrkit transports and sessions.

## Install

```bash
pnpm add @hrkit/otel
```

## Key features

- **OpenTelemetry-compatible** — spans and metrics following OTel conventions
- **Transport instrumentation** — automatic tracing of scan/connect/disconnect lifecycle
- **Session metrics** — export HR, HRV, and zone data as OTel metrics
- **Zero runtime deps** — uses the OTel API interface only (bring your own SDK)

## Quick example

```typescript
import { instrumentTransport } from '@hrkit/otel';

const traced = instrumentTransport(transport);
// All scan/connect calls now emit OTel spans automatically
const connection = await connectToDevice(traced, GENERIC_HR);
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/otel#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/otel`](https://github.com/josedab/hrkit/tree/main/packages/otel) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/otel)
