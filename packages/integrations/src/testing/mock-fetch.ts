/**
 * Mock HTTP fixture harness for testing @hrkit/integrations consumers.
 *
 * Usage:
 * ```ts
 * import { MockFetch } from '@hrkit/integrations/testing';
 *
 * const mock = new MockFetch()
 *   .when('POST', /\/uploads$/)
 *     .reply(201, { id: 42 })
 *   .when('GET', /\/users\/me/)
 *     .reply(200, { id: 'me' });
 *
 * const uploader = new StravaUploader({ accessToken: 't', fetch: mock.fetch });
 * await uploader.upload(session);
 *
 * expect(mock.calls).toHaveLength(1);
 * expect(mock.calls[0].url).toContain('/uploads');
 * ```
 */

import type { FetchLike } from '../providers/index.js';

export interface MockCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: BodyInit | string | Uint8Array;
}

interface Route {
  method: string;
  matcher: RegExp | string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

interface PendingRoute {
  reply(status: number, body: unknown, headers?: Record<string, string>): MockFetch;
}

/** A configurable, recording fetch double. */
export class MockFetch {
  /** All requests captured in order. */
  readonly calls: MockCall[] = [];
  private routes: Route[] = [];

  /** The {@link FetchLike}-compatible function — pass to provider configs. */
  readonly fetch: FetchLike = async (input, init) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    this.calls.push({ method, url, headers, body: init?.body });

    const route = this.routes.find((r) => r.method === method && this.matches(r.matcher, url));
    if (!route) {
      throw new Error(`MockFetch: no route registered for ${method} ${url}`);
    }
    const responseBody = route.body;
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      statusText: '',
      text: async () => (typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)),
      json: async () => responseBody,
    };
  };

  /** Register a route. Chain `.reply(...)` to set the response. */
  when(method: string, matcher: RegExp | string): PendingRoute {
    const self = this;
    const m = method.toUpperCase();
    return {
      reply(status: number, body: unknown, headers?: Record<string, string>): MockFetch {
        self.routes.push({ method: m, matcher, status, body, headers });
        return self;
      },
    };
  }

  /** Reset recorded calls (routes are kept). */
  reset(): void {
    this.calls.length = 0;
  }

  /** Drop every route and recorded call. */
  clear(): void {
    this.calls.length = 0;
    this.routes.length = 0;
  }

  private matches(matcher: RegExp | string, url: string): boolean {
    return typeof matcher === 'string' ? url.includes(matcher) : matcher.test(url);
  }
}
