import { describe, expect, it, vi } from 'vitest';
import { type FetchLike, HRKIT_USER_AGENT, staticTokenProvider, withAuth, withUserAgent } from '../providers/index.js';

const okResponse = (status = 200) => ({
  ok: status < 400,
  status,
  text: async () => '',
  json: async () => ({}),
});

describe('withUserAgent', () => {
  it('adds the SDK User-Agent when missing', async () => {
    const inner = vi.fn(async () => okResponse()) as unknown as FetchLike;
    const wrapped = withUserAgent(inner);
    await wrapped('https://example.com', { headers: { Accept: 'application/json' } });
    const init = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers['User-Agent']).toBe(HRKIT_USER_AGENT);
    expect(init.headers.Accept).toBe('application/json');
  });

  it('does not override an explicit User-Agent', async () => {
    const inner = vi.fn(async () => okResponse()) as unknown as FetchLike;
    const wrapped = withUserAgent(inner);
    await wrapped('https://example.com', { headers: { 'user-agent': 'mine/1.0' } });
    const init = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers['user-agent']).toBe('mine/1.0');
    expect(init.headers['User-Agent']).toBeUndefined();
  });
});

describe('withAuth', () => {
  it('attaches Authorization on every request', async () => {
    const inner = vi.fn(async () => okResponse()) as unknown as FetchLike;
    const wrapped = withAuth(inner, staticTokenProvider('abc'));
    await wrapped('https://example.com');
    const init = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('refreshes token once on 401 and replays', async () => {
    let n = 0;
    const inner = vi.fn(async () => okResponse(n++ === 0 ? 401 : 200)) as unknown as FetchLike;
    const refresh = vi.fn(async () => 'new-token');
    const tokens = { getToken: () => 'old', refresh };
    const wrapped = withAuth(inner, tokens);
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledOnce();
    const lastCall = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[1]?.[1] as {
      headers: Record<string, string>;
    };
    expect(lastCall.headers.Authorization).toBe('Bearer new-token');
  });

  it('does not retry when refresh returns same token', async () => {
    const inner = vi.fn(async () => okResponse(401)) as unknown as FetchLike;
    const refresh = vi.fn(async () => 'same');
    const tokens = { getToken: () => 'same', refresh };
    const wrapped = withAuth(inner, tokens);
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(401);
    expect(inner).toHaveBeenCalledOnce();
  });

  it('omits Authorization when token is null', async () => {
    const inner = vi.fn(async () => okResponse()) as unknown as FetchLike;
    const wrapped = withAuth(inner, { getToken: () => null });
    await wrapped('https://example.com');
    const init = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as {
      headers: Record<string, string>;
    };
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('forwards AbortSignal through to inner fetch', async () => {
    const inner = vi.fn(async () => okResponse()) as unknown as FetchLike;
    const wrapped = withAuth(inner, staticTokenProvider('t'));
    const ctrl = new AbortController();
    await wrapped('https://example.com', { signal: ctrl.signal });
    const init = (inner as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1] as {
      signal: AbortSignal;
    };
    expect(init.signal).toBe(ctrl.signal);
  });
});
