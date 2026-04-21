---
title: "@hrkit/cli"
description: "Command-line tools for @hrkit — simulate sensors, replay fixtures, and submit recordings to the conformance corpus."
---

# @hrkit/cli

Command-line tools for @hrkit — simulate sensors, replay fixtures, and submit recordings to the conformance corpus.

## Install

```bash
pnpm add @hrkit/cli
```

## Key features

- **`simulate`** — generate synthetic HR data for testing
- **`submit-fixture`** — submit recordings to the conformance corpus
- **`keygen`** — generate ECDSA P-256 key pairs for bundle signing
- **`sign`** — sign a conformance bundle
- **`verify`** — verify a signed conformance bundle

## Quick example

```bash
# Simulate a 5-minute HR session
npx @hrkit/cli simulate --duration 300 --output session.json

# Generate a signing key pair
npx @hrkit/cli keygen --out keys/

# Sign and verify a conformance bundle
npx @hrkit/cli sign --key keys/private.pem --bundle session.json
npx @hrkit/cli verify --key keys/public.pem --bundle session.json.signed
```

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/cli#readme) for more runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[`packages/cli`](https://github.com/josedab/hrkit/tree/main/packages/cli) · v0.1.0 · [npm](https://www.npmjs.com/package/@hrkit/cli)
