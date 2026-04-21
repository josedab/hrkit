---
title: "@hrkit/bundle"
description: "Sign & verify @hrkit conformance bundles using Web Crypto ECDSA P-256."
---

# @hrkit/bundle

Sign & verify @hrkit conformance bundles using Web Crypto ECDSA P-256.

## Install

```bash
pnpm add @hrkit/bundle
```

## Key features

- **ECDSA P-256 signing** — sign conformance bundles using Web Crypto API
- **Bundle verification** — verify bundle integrity and authenticity
- **Platform-portable** — works in Node.js, browsers, and edge runtimes via Web Crypto

## Quick example

```typescript
import { signBundle, verifyBundle } from '@hrkit/bundle';

const { signed } = await signBundle(bundleData, privateKey);
const isValid = await verifyBundle(signed, publicKey);
console.log('Valid:', isValid); // true
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/bundle#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/bundle`](https://github.com/josedab/hrkit/tree/main/packages/bundle) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/bundle)
