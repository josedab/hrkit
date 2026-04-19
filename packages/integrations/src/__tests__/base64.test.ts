import { describe, expect, it } from 'vitest';
import { base64EncodeString } from '../base64.js';

describe('base64EncodeString', () => {
  it('encodes an empty string', () => {
    expect(base64EncodeString('')).toBe('');
  });

  it('encodes a short ASCII string', () => {
    expect(base64EncodeString('hello')).toBe(btoa('hello'));
  });

  it('encodes single character', () => {
    expect(base64EncodeString('a')).toBe(btoa('a'));
  });

  it('encodes two characters (padding = 1)', () => {
    expect(base64EncodeString('ab')).toBe(btoa('ab'));
  });

  it('encodes three characters (no padding)', () => {
    expect(base64EncodeString('abc')).toBe(btoa('abc'));
  });

  it('handles all printable ASCII characters', () => {
    const printable = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
    expect(base64EncodeString(printable)).toBe(btoa(printable));
  });

  it('encodes numeric strings', () => {
    expect(base64EncodeString('12345')).toBe(btoa('12345'));
  });

  it('encodes JSON-like content (FIT export use case)', () => {
    const json = '{"activity_type":"run","elapsed_time":3600}';
    expect(base64EncodeString(json)).toBe(btoa(json));
  });

  it('uses pure-JS fallback when btoa is unavailable', () => {
    const original = globalThis.btoa;
    try {
      // biome-ignore lint/performance/noDelete: test needs to remove btoa
      delete (globalThis as Record<string, unknown>).btoa;
      expect(base64EncodeString('hello')).toBe(original('hello'));
      expect(base64EncodeString('ab')).toBe(original('ab'));
      expect(base64EncodeString('abc')).toBe(original('abc'));
      expect(base64EncodeString('')).toBe('');
    } finally {
      globalThis.btoa = original;
    }
  });

  it('pure-JS fallback handles all padding cases', () => {
    const original = globalThis.btoa;
    try {
      // biome-ignore lint/performance/noDelete: test needs to remove btoa
      delete (globalThis as Record<string, unknown>).btoa;
      // 1 byte → 2 padding chars
      expect(base64EncodeString('a')).toBe(original('a'));
      // 2 bytes → 1 padding char
      expect(base64EncodeString('ab')).toBe(original('ab'));
      // 3 bytes → no padding
      expect(base64EncodeString('abc')).toBe(original('abc'));
      // 4 bytes → 2 padding chars
      expect(base64EncodeString('abcd')).toBe(original('abcd'));
    } finally {
      globalThis.btoa = original;
    }
  });
});
