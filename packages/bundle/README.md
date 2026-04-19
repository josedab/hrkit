# @hrkit/bundle

Sign & verify [@hrkit](https://github.com/josedab/hrkit) conformance bundles using Web Crypto **ECDSA P-256 / SHA-256** with **RFC-8785-style canonical JSON**.

Runs anywhere Web Crypto exists: browsers, Node ≥ 18, Deno, Bun, Cloudflare Workers.

## Install

```bash
npm install @hrkit/bundle
```

## Usage

```ts
import {
  generateKeyPair,
  signBundle,
  verifyBundle,
  exportPublicKey,
  importPublicKey,
} from '@hrkit/bundle';

const { publicKey, privateKey } = await generateKeyPair();

// Sign any JSON-serializable payload (the SDK's ConformanceFixture, a session,
// a manifest, etc.). The signature is detached: payload + sig metadata.
const signed = await signBundle(
  { sessionId: 'abc', samples: [/* … */] },
  { privateKey, publicKey, signer: 'jane@example.com' },
);

// Anywhere later (different process / device / repo) — TOFU:
const result = await verifyBundle(signed);
console.log(result.ok, result.signer);

// Or pin to a known publisher key — exact byte match required:
const expected = await exportPublicKey(trustedKey);
const result2 = await verifyBundle(signed, { expectedPublicKey: expected });
if (!result2.ok) console.error('rejected:', result2.reason);
```

## Why canonical JSON

`canonicalJSON` produces a stable byte representation regardless of object-key order, so a bundle round-tripped through `JSON.parse` / `JSON.stringify` (or copy-pasted into a different app) still verifies. Keys are sorted, no whitespace, no trailing commas — RFC-8785-compatible for the cases @hrkit cares about.

## API

| Symbol | Description |
|--------|-------------|
| `signBundle(payload, opts)` | Returns `SignedBundle<T>` — `{ payload, signature }`. |
| `verifyBundle(bundle, { expectedPublicKey? })` | Returns `{ ok, reason?, signer? }`. **Always inspect `ok`** — it never throws on bad sigs. |
| `generateKeyPair()` | New ECDSA P-256 `CryptoKeyPair` with `extractable: true`. |
| `exportPublicKey(key)` | Base64-encoded SPKI string — safe to embed in JSON or commit alongside fixtures. |
| `importPublicKey(spkiB64)` | Inverse of `exportPublicKey`. |
| `canonicalJSON(value)` | Stable byte representation; exported so callers can hash payloads themselves. |
| `SIGN_ALG` | `'ECDSA-P256-SHA256'` constant — embedded in every signature for forward-compat. |

## Bundle wire shape

```ts
interface SignedBundle<T> {
  payload: T;
  signature: {
    alg: 'ECDSA-P256-SHA256';
    sig: string;          // base64 raw r||s, 64 bytes
    publicKey: string;    // base64 SPKI
    signer?: string;      // human-readable identifier (display only)
    signedAt: string;     // ISO-8601
  };
}
```

The signature is **detached** — it does not modify the payload. That means:

- A `SignedBundle` can be peeled to its `payload` and consumed by any non-crypto-aware code.
- Re-stringifying the payload with different key ordering is still verifiable thanks to canonical JSON.
- `expectedPublicKey` enforces exact-match pinning for publisher trust; omit it for TOFU.

## Failure modes

`verifyBundle` returns a structured `VerifyResult` rather than throwing. Possible `reason` strings:

- `unsupported alg: …` — bundle uses a different algorithm
- `public key does not match expected` — pinning failure
- `public key import failed: …` — malformed SPKI in `signature.publicKey`
- `signature verification failed` — payload tampered with, or wrong key

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/bundle/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
