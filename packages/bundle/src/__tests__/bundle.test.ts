import { describe, expect, it } from 'vitest';
import { canonicalJSON, exportPublicKey, generateKeyPair, signBundle, verifyBundle } from '../index.js';

describe('canonicalJSON', () => {
  it('sorts keys recursively', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJSON({ z: { c: 1, a: 2 }, a: [3, 1, 2] })).toBe('{"a":[3,1,2],"z":{"a":2,"c":1}}');
  });
  it('preserves array order', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]');
  });
  it('handles primitives and null', () => {
    expect(canonicalJSON(null)).toBe('null');
    expect(canonicalJSON('x')).toBe('"x"');
    expect(canonicalJSON(42)).toBe('42');
  });
});

describe('signBundle / verifyBundle', () => {
  it('signs and verifies a payload', async () => {
    const kp = await generateKeyPair();
    const payload = { hello: 'world', n: 42 };
    const bundle = await signBundle(payload, {
      privateKey: kp.privateKey,
      publicKey: kp.publicKey,
      signer: 'tester',
    });
    expect(bundle.signature.alg).toBe('ECDSA-P256-SHA256');
    expect(bundle.signature.signer).toBe('tester');

    const result = await verifyBundle(bundle);
    expect(result.ok).toBe(true);
    expect(result.signer).toBe('tester');
  });

  it('detects payload tampering', async () => {
    const kp = await generateKeyPair();
    const bundle = await signBundle({ hr: 75 }, { privateKey: kp.privateKey, publicKey: kp.publicKey });
    bundle.payload = { hr: 76 } as typeof bundle.payload;
    const result = await verifyBundle(bundle);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/);
  });

  it('rejects when expected public key mismatches', async () => {
    const kp1 = await generateKeyPair();
    const kp2 = await generateKeyPair();
    const bundle = await signBundle({ x: 1 }, { privateKey: kp1.privateKey, publicKey: kp1.publicKey });
    const otherPub = await exportPublicKey(kp2.publicKey);
    const result = await verifyBundle(bundle, { expectedPublicKey: otherPub });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expected/);
  });

  it('order-independent: re-signing equivalent objects yields verifiable bundles', async () => {
    const kp = await generateKeyPair();
    const a = await signBundle({ a: 1, b: 2 }, { privateKey: kp.privateKey, publicKey: kp.publicKey });
    const b = await signBundle({ b: 2, a: 1 }, { privateKey: kp.privateKey, publicKey: kp.publicKey });
    expect((await verifyBundle(a)).ok).toBe(true);
    expect((await verifyBundle(b)).ok).toBe(true);
  });
});
