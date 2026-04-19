import { describe, expect, it } from 'vitest';
import { MockFetch } from '../testing/index.js';

describe('MockFetch', () => {
  it('routes by method + regex and records calls', async () => {
    const mock = new MockFetch();
    mock.when('POST', /\/uploads$/).reply(201, { id: 7 });
    mock.when('GET', '/me').reply(200, { id: 'me' });

    const a = await mock.fetch('https://example.com/uploads', { method: 'POST', body: 'x' });
    const b = await mock.fetch('https://example.com/me');

    expect(a.status).toBe(201);
    expect(await a.json()).toEqual({ id: 7 });
    expect(b.status).toBe(200);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0]?.method).toBe('POST');
    expect(mock.calls[0]?.body).toBe('x');
  });

  it('throws on unmatched routes', async () => {
    const mock = new MockFetch();
    await expect(mock.fetch('https://example.com/x')).rejects.toThrow(/no route registered/);
  });

  it('reset() clears calls but keeps routes', async () => {
    const mock = new MockFetch();
    mock.when('GET', '/x').reply(200, {});
    await mock.fetch('https://example.com/x');
    mock.reset();
    expect(mock.calls).toHaveLength(0);
    await mock.fetch('https://example.com/x');
    expect(mock.calls).toHaveLength(1);
  });

  it('clear() drops routes and calls', async () => {
    const mock = new MockFetch();
    mock.when('GET', '/x').reply(200, {});
    await mock.fetch('https://example.com/x');
    mock.clear();
    await expect(mock.fetch('https://example.com/x')).rejects.toThrow();
  });
});
