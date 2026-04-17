/**
 * OpenTelemetry-shaped instrumentation hooks for @hrkit.
 *
 * The SDK has zero opinion on observability backends. This package defines a
 * minimal {@link InstrumentationHooks} interface that mirrors the OTel
 * tracer/meter API so any backend (OTLP, Datadog, Honeycomb, console) can be
 * wired in with a small adapter.
 *
 * `wrapTransport` decorates a {@link BLETransport} so connect / disconnect /
 * scan operations emit spans, and HR packets emit a `hrkit.hr.bpm` gauge.
 * Use it once at app startup; the rest of the SDK is unchanged.
 */
import type { BLETransport, DeviceProfile, HRConnection, HRDevice, HRPacket } from '@hrkit/core';

export interface SpanContext {
  spanId: string;
  startedAt: number;
}

export type MetricKind = 'counter' | 'gauge' | 'histogram';

export interface InstrumentationHooks {
  onSpanStart(name: string, attrs?: Record<string, string | number | boolean>): SpanContext;
  onSpanEnd(ctx: SpanContext, status: 'ok' | 'error', error?: Error): void;
  onMetric(name: string, kind: MetricKind, value: number, attrs?: Record<string, string | number | boolean>): void;
}

export const NOOP_HOOKS: InstrumentationHooks = {
  onSpanStart: () => ({ spanId: 'noop', startedAt: Date.now() }),
  onSpanEnd: () => undefined,
  onMetric: () => undefined,
};

/** Hooks that record everything in memory — handy for tests + offline analysis. */
export class MemoryHooks implements InstrumentationHooks {
  spans: Array<{ name: string; status?: 'ok' | 'error'; durationMs?: number; attrs?: Record<string, unknown> }> = [];
  metrics: Array<{ name: string; kind: MetricKind; value: number; attrs?: Record<string, unknown> }> = [];
  private nextId = 1;
  onSpanStart(name: string, attrs?: Record<string, string | number | boolean>): SpanContext {
    const id = String(this.nextId++);
    this.spans.push({ name, attrs });
    return { spanId: id, startedAt: Date.now() };
  }
  onSpanEnd(ctx: SpanContext, status: 'ok' | 'error'): void {
    const span = this.spans[Number(ctx.spanId) - 1];
    if (span) {
      span.status = status;
      span.durationMs = Date.now() - ctx.startedAt;
    }
  }
  onMetric(name: string, kind: MetricKind, value: number, attrs?: Record<string, string | number | boolean>): void {
    this.metrics.push({ name, kind, value, attrs });
  }
}

/** Wrap a connection so heart-rate packets emit a `hrkit.hr.bpm` gauge. */
function wrapConnection(conn: HRConnection, hooks: InstrumentationHooks): HRConnection {
  const attrs = { deviceId: conn.deviceId, deviceName: conn.deviceName };
  return {
    deviceId: conn.deviceId,
    deviceName: conn.deviceName,
    profile: conn.profile,
    async *heartRate(): AsyncIterable<HRPacket> {
      for await (const pkt of conn.heartRate()) {
        hooks.onMetric('hrkit.hr.bpm', 'gauge', pkt.hr, attrs);
        if (pkt.rrIntervals) {
          for (const rr of pkt.rrIntervals) {
            hooks.onMetric('hrkit.rr.ms', 'histogram', rr, attrs);
          }
        }
        yield pkt;
      }
    },
    async disconnect() {
      const span = hooks.onSpanStart('hrkit.ble.disconnect', attrs);
      try {
        await conn.disconnect();
        hooks.onSpanEnd(span, 'ok');
      } catch (err) {
        hooks.onSpanEnd(span, 'error', err as Error);
        throw err;
      }
    },
  } as HRConnection;
}

/**
 * Wrap a {@link BLETransport} so its lifecycle emits OTel-shaped spans and
 * HR notifications emit metrics. The returned transport is API-compatible
 * with the original.
 */
export function wrapTransport(transport: BLETransport, hooks: InstrumentationHooks = NOOP_HOOKS): BLETransport {
  return {
    async *scan(profiles?: DeviceProfile[]): AsyncIterable<HRDevice> {
      const span = hooks.onSpanStart('hrkit.ble.scan', { profiles: (profiles ?? []).map((p) => p.model).join(',') });
      let count = 0;
      try {
        for await (const dev of transport.scan(profiles)) {
          count++;
          yield dev;
        }
        hooks.onMetric('hrkit.ble.scan.devices', 'counter', count);
        hooks.onSpanEnd(span, 'ok');
      } catch (err) {
        hooks.onSpanEnd(span, 'error', err as Error);
        throw err;
      }
    },
    async stopScan() {
      await transport.stopScan();
    },
    async connect(deviceId: string, profile: DeviceProfile): Promise<HRConnection> {
      const span = hooks.onSpanStart('hrkit.ble.connect', { deviceId, profile: profile.model });
      try {
        const conn = await transport.connect(deviceId, profile);
        hooks.onSpanEnd(span, 'ok');
        return wrapConnection(conn, hooks);
      } catch (err) {
        hooks.onSpanEnd(span, 'error', err as Error);
        throw err;
      }
    },
  };
}

/** Convenience: emit a single HR sample to the configured hooks. */
export function recordHrSample(
  hooks: InstrumentationHooks,
  hr: number,
  attrs?: Record<string, string | number | boolean>,
): void {
  hooks.onMetric('hrkit.hr.bpm', 'gauge', hr, attrs);
}
