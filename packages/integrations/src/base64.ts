/** Runtime-portable base64 encoder for ASCII strings (no Buffer dependency). */
export function base64EncodeString(s: string): string {
  // biome-ignore lint/suspicious/noExplicitAny: env-dependent
  const g = globalThis as any;
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  if (typeof g.btoa === 'function') return g.btoa(bin);
  // Pure-JS fallback — only used in environments without btoa.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;
    out += chars.charAt(b1 >> 2);
    out += chars.charAt(((b1 & 0x03) << 4) | (b2 >> 4));
    out += i + 1 < bytes.length ? chars.charAt(((b2 & 0x0f) << 2) | (b3 >> 6)) : '=';
    out += i + 2 < bytes.length ? chars.charAt(b3 & 0x3f) : '=';
  }
  return out;
}
