/**
 * @hrkit quickstart — runnable in CI without real BLE hardware.
 *
 * Demonstrates the canonical flow:
 *   1. Pick a transport (MockTransport here; in production swap for
 *      WebBluetoothTransport / ReactNativeBLETransport / CapacitorBLETransport).
 *   2. Scan for a device matching a profile.
 *   3. Connect and stream HR packets.
 *   4. Roll the stream through SessionRecorder for live metrics.
 *
 * Run from repo root:
 *   pnpm --filter @hrkit/examples quickstart
 */
import { GENERIC_HR, MockTransport, SessionRecorder } from '@hrkit/core';
import type { MockFixture } from '@hrkit/core';

const fixture: MockFixture = {
  device: { id: 'demo-1', name: 'Demo HR' },
  packets: Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 1000,
    hr: 120 + Math.round(Math.sin(i / 3) * 15),
    rrIntervals: [500 + (i % 5) * 10],
    contactDetected: true,
  })),
};

async function main(): Promise<void> {
  const transport = new MockTransport(fixture);

  let target: { id: string; name: string } | null = null;
  for await (const dev of transport.scan([GENERIC_HR])) {
    console.log(`scan: found ${dev.name} (${dev.id})`);
    target = dev;
    break;
  }
  if (!target) throw new Error('no devices found');

  const conn = await transport.connect(target.id, GENERIC_HR);
  const recorder = new SessionRecorder({ maxHR: 190 });

  for await (const packet of conn.heartRate()) {
    recorder.ingest(packet);
  }

  const session = recorder.end();
  const avg =
    session.samples.length > 0
      ? Math.round(session.samples.reduce((s, x) => s + x.hr, 0) / session.samples.length)
      : 0;
  console.log(`session: ${session.samples.length} samples, avgHR=${avg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
