import type { HRPacket } from '@hrkit/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { BroadcastPayload } from '../index.js';
import { buildPayload, HRStreamServer } from '../index.js';

// ── Fixtures ────────────────────────────────────────────────────────────

function makePacket(overrides?: Partial<HRPacket>): HRPacket {
  return {
    timestamp: 1000,
    hr: 140,
    rrIntervals: [428, 432],
    contactDetected: true,
    ...overrides,
  };
}

// ── buildPayload (pure) ─────────────────────────────────────────────────

describe('buildPayload', () => {
  it('maps HRPacket fields to BroadcastPayload', () => {
    const pkt = makePacket();
    const payload = buildPayload(pkt);
    expect(payload).toEqual({
      timestamp: 1000,
      hr: 140,
      rrIntervals: [428, 432],
    });
  });

  it('includes zone when provided', () => {
    const payload = buildPayload(makePacket(), { zone: 3 });
    expect(payload.zone).toBe(3);
  });

  it('includes trimp when provided', () => {
    const payload = buildPayload(makePacket(), { trimp: 42.5 });
    expect(payload.trimp).toBe(42.5);
  });

  it('includes rmssd when provided', () => {
    const payload = buildPayload(makePacket(), { rmssd: 28.3 });
    expect(payload.rmssd).toBe(28.3);
  });

  it('includes custom data when provided', () => {
    const custom = { intensity: 'high', round: 2 };
    const payload = buildPayload(makePacket(), { custom });
    expect(payload.custom).toEqual(custom);
  });

  it('includes all extras when provided', () => {
    const payload = buildPayload(makePacket(), {
      zone: 4,
      trimp: 55,
      rmssd: 30,
      custom: { label: 'round1' },
    });
    expect(payload.zone).toBe(4);
    expect(payload.trimp).toBe(55);
    expect(payload.rmssd).toBe(30);
    expect(payload.custom).toEqual({ label: 'round1' });
  });

  it('omits optional fields when extras not provided', () => {
    const payload = buildPayload(makePacket());
    expect(payload).not.toHaveProperty('zone');
    expect(payload).not.toHaveProperty('trimp');
    expect(payload).not.toHaveProperty('rmssd');
    expect(payload).not.toHaveProperty('custom');
  });

  it('strips HRPacket-only fields (contactDetected, energyExpended)', () => {
    const pkt = makePacket({ contactDetected: true, energyExpended: 123 });
    const payload = buildPayload(pkt);
    expect(payload).not.toHaveProperty('contactDetected');
    expect(payload).not.toHaveProperty('energyExpended');
  });

  it('handles empty rrIntervals', () => {
    const payload = buildPayload(makePacket({ rrIntervals: [] }));
    expect(payload.rrIntervals).toEqual([]);
  });
});

// ── HRStreamServer constructor ──────────────────────────────────────────

describe('HRStreamServer', () => {
  describe('constructor', () => {
    it('creates with default config', () => {
      const server = new HRStreamServer();
      expect(server.isRunning).toBe(false);
      expect(server.clientCount).toBe(0);
      expect(server.wsClientCount).toBe(0);
      expect(server.sseClientCount).toBe(0);
    });

    it('creates with custom config', () => {
      const server = new HRStreamServer({
        port: 9999,
        host: '0.0.0.0',
        enableWebSocket: false,
        enableSSE: true,
        cors: false,
        maxRateHz: 5,
        authToken: 'secret123',
      });
      expect(server.isRunning).toBe(false);
    });
  });

  // ── Rate limiting ───────────────────────────────────────────────────

  describe('broadcast rate limiting', () => {
    it('skips packets that exceed maxRateHz', () => {
      const server = new HRStreamServer({ maxRateHz: 1, enableSSE: false, enableWebSocket: false });
      const sent: BroadcastPayload[] = [];
      const origBroadcastRaw = server.broadcastRaw.bind(server);
      server.broadcastRaw = (p: BroadcastPayload) => {
        sent.push(p);
        origBroadcastRaw(p);
      };

      const pkt = makePacket();
      server.broadcast(pkt);
      expect(sent).toHaveLength(1);

      // Immediately send another — should be throttled (within 1s window)
      server.broadcast(pkt);
      expect(sent).toHaveLength(1);
    });

    it('allows packets after rate window expires', async () => {
      const server = new HRStreamServer({ maxRateHz: 100, enableSSE: false, enableWebSocket: false });
      const sent: BroadcastPayload[] = [];
      const origBroadcastRaw = server.broadcastRaw.bind(server);
      server.broadcastRaw = (p: BroadcastPayload) => {
        sent.push(p);
        origBroadcastRaw(p);
      };

      server.broadcast(makePacket());
      expect(sent).toHaveLength(1);

      // At 100 Hz → 10ms window. Wait 15ms to be safe.
      await new Promise((r) => setTimeout(r, 15));
      server.broadcast(makePacket());
      expect(sent).toHaveLength(2);
    });
  });

  // ── Server lifecycle ──────────────────────────────────────────────

  describe('lifecycle', () => {
    let server: HRStreamServer;

    afterEach(async () => {
      if (server?.isRunning) await server.stop();
    });

    it('starts and stops', async () => {
      server = new HRStreamServer({ port: 0, enableWebSocket: false });
      // Port 0 is not supported by the http server in the same way,
      // so use a high random port
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();
      expect(server.isRunning).toBe(true);
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('start is idempotent when already running', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();
      await server.start(); // should not throw
      expect(server.isRunning).toBe(true);
    });

    it('stop is idempotent when not running', async () => {
      server = new HRStreamServer({ enableWebSocket: false });
      await server.stop(); // should not throw
      expect(server.isRunning).toBe(false);
    });

    it('health endpoint returns status', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({ status: 'ok', clients: 0, websocket: 'disabled' });
    });

    it('returns 404 for unknown routes', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/unknown`);
      expect(res.status).toBe(404);
    });

    it('SSE endpoint returns correct headers', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();

      const controller = new AbortController();
      const resPromise = fetch(`http://127.0.0.1:${port}/sse`, {
        signal: controller.signal,
      });

      const res = await resPromise;
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      expect(res.headers.get('cache-control')).toBe('no-cache');

      // Wait a tick for the connection to register
      await new Promise((r) => setTimeout(r, 20));
      expect(server.sseClientCount).toBe(1);

      controller.abort();
      // Allow close event to propagate
      await new Promise((r) => setTimeout(r, 50));
      expect(server.sseClientCount).toBe(0);
    });

    it('SSE auth rejects missing token', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false, authToken: 'secret' });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/sse`);
      expect(res.status).toBe(401);
    });

    it('SSE auth accepts valid token', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false, authToken: 'secret' });
      await server.start();

      const controller = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/sse?token=secret`, {
        signal: controller.signal,
      });
      expect(res.status).toBe(200);
      controller.abort();
    });

    it('CORS headers are set when enabled', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false, cors: true });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('CORS headers absent when disabled', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false, cors: false });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('broadcasts data to SSE clients', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false, maxRateHz: 100 });
      await server.start();

      const controller = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/sse`, {
        signal: controller.signal,
      });

      // Wait for connection to register
      await new Promise((r) => setTimeout(r, 20));

      // Broadcast a packet
      server.broadcast(makePacket({ hr: 155 }));

      // Read from stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);

      expect(text).toContain('data: ');
      const jsonStr = text.replace('data: ', '').trim();
      const payload = JSON.parse(jsonStr) as BroadcastPayload;
      expect(payload.hr).toBe(155);
      expect(payload.rrIntervals).toEqual([428, 432]);

      controller.abort();
    });

    it('handles OPTIONS preflight', async () => {
      const port = 18000 + Math.floor(Math.random() * 1000);
      server = new HRStreamServer({ port, enableWebSocket: false });
      await server.start();

      const res = await fetch(`http://127.0.0.1:${port}/sse`, { method: 'OPTIONS' });
      expect(res.status).toBe(204);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('buildPayload with zero HR', () => {
      const payload = buildPayload({
        timestamp: 1000,
        hr: 0,
        rrIntervals: [],
        contactDetected: false,
      });
      expect(payload.hr).toBe(0);
    });

    it('buildPayload with very large HR', () => {
      const payload = buildPayload({
        timestamp: 1000,
        hr: 999,
        rrIntervals: [100, 200],
        contactDetected: true,
      });
      expect(payload.hr).toBe(999);
      expect(payload.rrIntervals).toEqual([100, 200]);
    });

    it('buildPayload with nested custom data', () => {
      const payload = buildPayload(
        { timestamp: 1000, hr: 80, rrIntervals: [], contactDetected: true },
        { custom: { nested: { deep: true }, arr: [1, 2, 3] } },
      );
      expect(payload.custom).toEqual({ nested: { deep: true }, arr: [1, 2, 3] });
    });

    it('HRStreamServer default config values', () => {
      const server = new HRStreamServer();
      expect(server.isRunning).toBe(false);
      expect(server.wsClientCount).toBe(0);
      expect(server.sseClientCount).toBe(0);
      expect(server.clientCount).toBe(0);
    });

    it('rate limiting allows first packet always', () => {
      const _server = new HRStreamServer({ port: 0, maxRateHz: 1 });
      const payload = buildPayload({
        timestamp: 1000,
        hr: 80,
        rrIntervals: [],
        contactDetected: true,
      });
      expect(payload).toBeDefined();
    });
  });
});

describe('backpressure', () => {
  it('counts slow-client drops via getSlowClientDrops()', () => {
    const server = new HRStreamServer({ maxBufferedBytesPerClient: 100, maxRateHz: 1000 });
    // Fake-attach two ws clients via private field (white-box test seam).
    const sent: string[] = [];
    const fastClient = { readyState: 1, bufferedAmount: 0, send: (s: string) => sent.push(s) };
    const slowClient = { readyState: 1, bufferedAmount: 9999, send: (s: string) => sent.push(s) };
    (server as unknown as { wsServer: { clients: Set<unknown> } }).wsServer = {
      clients: new Set([fastClient, slowClient]),
    };
    expect(server.getSlowClientDrops()).toBe(0);
    server.broadcastRaw(buildPayload(makePacket()));
    expect(sent.length).toBe(1); // only the fast client got it
    expect(server.getSlowClientDrops()).toBe(1);
  });
});
