/**
 * Sign and verify `@hrkit` conformance bundles.
 *
 * A {@link SignedBundle} wraps an existing {@link ConformanceFixture} (or any
 * JSON payload) with an ECDSA P-256 signature over a canonical-JSON encoding
 * of the payload. ECDSA P-256 is used because it works in every modern
 * runtime that exposes Web Crypto (browsers, Node 18+, Workers, Deno, Bun);
 * Ed25519 support is still uneven on Workers as of 2024.
 *
 * The signature covers a stable byte sequence: keys are sorted recursively,
 * objects/arrays are JSON-stringified without insignificant whitespace, and
 * the `signature` field itself is excluded.
 */

import type { ConformanceFixture } from '@hrkit/core';

/** Algorithm identifier embedded in every signed bundle. */
export const SIGN_ALG = 'ECDSA-P256-SHA256' as const;

/** Wraps a payload with a detached signature. */
export interface SignedBundle<T = ConformanceFixture> {
  /** Signed payload — a conformance fixture or arbitrary JSON object. */
  payload: T;
  /** Signature metadata. */
  signature: {
    alg: typeof SIGN_ALG;
    /** Base64-encoded raw (r||s) ECDSA signature, 64 bytes. */
    sig: string;
    /** Base64-encoded SubjectPublicKeyInfo (SPKI) of the signer. */
    publicKey: string;
    /** Optional human-readable signer identifier (e.g. GitHub handle). */
    signer?: string;
    /** ISO-8601 timestamp the signature was produced. */
    signedAt: string;
  };
}

/** Stable RFC-8785-style canonical JSON: sorted keys, no whitespace. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJSON(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`);
  return `{${parts.join(',')}}`;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto SubtleCrypto API is required for @hrkit/bundle');
  }
  return c.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate a fresh ECDSA P-256 keypair. Returned keys are extractable. */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await getSubtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

/** Export a public key to base64-encoded SPKI for embedding in a bundle. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const buf = await getSubtle().exportKey('spki', key);
  return bytesToBase64(new Uint8Array(buf));
}

/** Import a base64-encoded SPKI public key for verification. */
export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return await getSubtle().importKey('spki', base64ToBytes(spkiB64), { name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'verify',
  ]);
}

export interface SignBundleOptions {
  /** Private key for signing (must support 'sign'). */
  privateKey: CryptoKey;
  /** Public key matching the private key. Embedded in the signature. */
  publicKey: CryptoKey;
  /** Optional signer identity (display only). */
  signer?: string;
  /** Override the timestamp (defaults to `new Date().toISOString()`). */
  signedAt?: string;
}

/** Produce a {@link SignedBundle} for an arbitrary payload. */
export async function signBundle<T>(payload: T, opts: SignBundleOptions): Promise<SignedBundle<T>> {
  const subtle = getSubtle();
  const canonical = new TextEncoder().encode(canonicalJSON(payload));
  const sigBuf = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, opts.privateKey, canonical);
  const publicKeyB64 = await exportPublicKey(opts.publicKey);
  return {
    payload,
    signature: {
      alg: SIGN_ALG,
      sig: bytesToBase64(new Uint8Array(sigBuf)),
      publicKey: publicKeyB64,
      ...(opts.signer !== undefined ? { signer: opts.signer } : {}),
      signedAt: opts.signedAt ?? new Date().toISOString(),
    },
  };
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  signer?: string;
}

/**
 * Verify a {@link SignedBundle}. If `expectedPublicKey` is provided, the
 * embedded key must match it byte-for-byte; otherwise any well-formed key is
 * accepted (TOFU — useful for first-contact validation).
 */
export async function verifyBundle<T>(
  bundle: SignedBundle<T>,
  opts: { expectedPublicKey?: string } = {},
): Promise<VerifyResult> {
  if (bundle.signature.alg !== SIGN_ALG) {
    return { ok: false, reason: `unsupported alg: ${bundle.signature.alg}` };
  }
  if (opts.expectedPublicKey && opts.expectedPublicKey !== bundle.signature.publicKey) {
    return { ok: false, reason: 'public key does not match expected' };
  }
  let key: CryptoKey;
  try {
    key = await importPublicKey(bundle.signature.publicKey);
  } catch (e) {
    return { ok: false, reason: `public key import failed: ${(e as Error).message}` };
  }
  const canonical = new TextEncoder().encode(canonicalJSON(bundle.payload));
  let ok: boolean;
  try {
    ok = await getSubtle().verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64ToBytes(bundle.signature.sig),
      canonical,
    );
  } catch (e) {
    return { ok: false, reason: `verify threw: ${(e as Error).message}` };
  }
  return ok
    ? { ok: true, ...(bundle.signature.signer !== undefined ? { signer: bundle.signature.signer } : {}) }
    : { ok: false, reason: 'signature does not match payload' };
}
