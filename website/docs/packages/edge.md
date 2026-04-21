---
title: "@hrkit/edge"
description: "Runtime-portable HR ingestion for Cloudflare Workers / Deno / Bun edge environments"
---

# @hrkit/edge

Runtime-portable HR ingestion for Cloudflare Workers / Deno / Bun edge environments

## Install

```bash
pnpm add @hrkit/edge
```

## Key features

- **Runtime-portable** — works on Cloudflare Workers, Deno, and Bun
- **HR ingestion** — process incoming HR data at the edge with zero cold-start overhead
- **Lightweight** — no Node.js-specific APIs, pure Web Standards

## Quick example

```typescript
import { handleHRRequest } from '@hrkit/edge';

export default {
  async fetch(request: Request): Promise<Response> {
    return handleHRRequest(request);
  },
};
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/edge#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/edge`](https://github.com/josedab/hrkit/tree/main/packages/edge) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/edge)
