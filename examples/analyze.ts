/**
 * @hrkit post-session analysis example.
 *
 * Demonstrates how to analyze a recorded session for:
 *   - HRV metrics (rMSSD, SDNN, pNN50)
 *   - Training load (TRIMP)
 *   - Zone distribution
 *   - VO2max estimation
 *   - Stress scoring
 *   - Training readiness
 *
 * Run from repo root:
 *   pnpm --filter @hrkit/examples analyze
 */
import {
  analyzeSession,
  computeStress,
  estimateVO2maxUth,
  fitnessScore,
  GENERIC_HR,
  MockTransport,
  rmssd,
  readinessVerdict,
  SessionRecorder,
  type MockFixture,
} from '@hrkit/core';

// Generate a 10-minute synthetic workout session
const fixture: MockFixture = {
  device: { id: 'analyze-demo', name: 'Analysis Demo' },
  packets: Array.from({ length: 600 }, (_, i) => {
    const phase = i < 120 ? 'warmup' : i < 480 ? 'work' : 'cooldown';
    const baseHR = phase === 'warmup' ? 100 : phase === 'work' ? 155 : 110;
    const hr = baseHR + Math.round(Math.sin(i / 10) * 8);
    return {
      timestamp: i * 1000,
      hr,
      rrIntervals: [Math.round(60000 / hr) + (i % 3) * 5],
      contactDetected: true,
    };
  }),
};

async function main(): Promise<void> {
  // Record the session
  const transport = new MockTransport(fixture);
  const recorder = new SessionRecorder({ maxHR: 190, restHR: 55, sex: 'male' });

  for await (const dev of transport.scan([GENERIC_HR])) {
    const conn = await transport.connect(dev.id, GENERIC_HR);
    for await (const pkt of conn.heartRate()) {
      recorder.ingest(pkt);
    }
    break;
  }

  const session = recorder.end();
  console.log(`\n📊 Session: ${session.samples.length} samples, ${Math.round((session.endTime - session.startTime) / 60000)}min\n`);

  // ── Full Analysis ───────────────────────────────────────────────
  const analysis = analyzeSession(session);
  console.log('=== Session Analysis ===');
  console.log(`  HR: min=${analysis.hr.min} avg=${analysis.hr.mean} max=${analysis.hr.max}`);
  console.log(`  TRIMP: ${analysis.trimp.toFixed(1)}`);
  console.log(`  Zones: Z1=${analysis.zones.zones[1]}s Z2=${analysis.zones.zones[2]}s Z3=${analysis.zones.zones[3]}s Z4=${analysis.zones.zones[4]}s Z5=${analysis.zones.zones[5]}s`);

  if (analysis.hrv) {
    console.log(`  HRV: rMSSD=${analysis.hrv.rmssd.toFixed(1)}ms SDNN=${analysis.hrv.sdnn.toFixed(1)}ms pNN50=${analysis.hrv.pnn50.toFixed(1)}%`);
  }

  // ── VO2max Estimation ───────────────────────────────────────────
  const vo2est = estimateVO2maxUth(190, 55);
  const fitness = fitnessScore(vo2est.vo2max, 30, 'male');
  console.log(`\n=== VO2max ===`);
  console.log(`  Estimate: ${vo2est.vo2max} ml/kg/min (${vo2est.method})`);
  console.log(`  Fitness: ${fitness.category} (${fitness.percentile}th percentile for ${fitness.ageGroup} ${fitness.sex})`);

  // ── Stress Score ────────────────────────────────────────────────
  const stress = computeStress({
    rrIntervals: session.rrIntervals.slice(-60),
    currentHR: session.samples.at(-1)?.hr ?? 70,
    restHR: 55,
    baselineRmssd: 45,
    subjectiveWellness: 7,
  });
  console.log(`\n=== Stress ===`);
  console.log(`  Score: ${stress.score}/100 (${stress.level})`);
  console.log(`  Components: HRV=${stress.components.hrv} HR=${stress.components.heartRate} BR=${stress.components.breathingRate}`);
  if (stress.breathingRateBPM) console.log(`  Breathing: ${stress.breathingRateBPM} bpm`);

  // ── Readiness ───────────────────────────────────────────────────
  const sessionRmssd = rmssd(session.rrIntervals.slice(-30));
  const verdict = readinessVerdict(sessionRmssd, 45);
  console.log(`\n=== Readiness ===`);
  console.log(`  Session rMSSD: ${sessionRmssd.toFixed(1)}ms`);
  console.log(`  Verdict: ${verdict}`);

  console.log('\n✅ Analysis complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
