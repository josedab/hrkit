/**
 * @hrkit training insights example.
 *
 * Demonstrates how to use training load analytics:
 *   - ACWR (Acute:Chronic Workload Ratio)
 *   - HRV trend analysis
 *   - Training monotony
 *   - Training readiness recommendation
 *   - Training plan creation and execution
 *
 * Run from repo root:
 *   pnpm --filter @hrkit/examples training
 */
import {
  analyzeHRVTrend,
  assessACWRRisk,
  calculateMonotony,
  createWeeklyPlan,
  getTrainingRecommendation,
  InMemoryAthleteStore,
  PlanRunner,
  SESSION_SCHEMA_VERSION,
  type Session,
} from '@hrkit/core';

// Simulate 14 days of training history
function buildHistory(): InMemoryAthleteStore {
  const store = new InMemoryAthleteStore();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (let d = 13; d >= 0; d--) {
    const startTime = now - d * day;
    const isHard = d % 3 === 0;
    const durationMin = isHard ? 50 : 30;
    const baseHR = isHard ? 155 : 120;

    // Build a minimal session for the store
    const samples = Array.from({ length: durationMin * 2 }, (_, i) => ({
      timestamp: startTime + i * 30000,
      hr: baseHR + Math.round((Math.random() - 0.5) * 10),
    }));
    const rr = samples.map((s) => Math.round(60000 / s.hr));

    const session: Session = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      startTime,
      endTime: startTime + durationMin * 60000,
      samples,
      rrIntervals: rr,
      rounds: [],
      config: { maxHR: 190, restHR: 55, sex: 'male' },
    };
    store.saveSession(session);
  }
  return store;
}

function main(): void {
  const store = buildHistory();
  const loadTrend = store.getTrainingLoadTrend();
  const hrvTrend = store.getHRVTrend();

  console.log('📊 Training Insights Example\n');

  // ── ACWR ──
  if (loadTrend.length > 0) {
    const latest = loadTrend[loadTrend.length - 1]!;
    const acwr = latest.ctl > 0 ? latest.atl / latest.ctl : 1;
    const risk = assessACWRRisk(acwr);
    console.log(`=== ACWR (Acute:Chronic Workload) ===`);
    console.log(`  ATL (acute): ${latest.atl.toFixed(1)}`);
    console.log(`  CTL (chronic): ${latest.ctl.toFixed(1)}`);
    console.log(`  ACWR: ${acwr.toFixed(2)} → Risk: ${risk}`);
  }

  // ── HRV Trend ──
  const trend = analyzeHRVTrend(hrvTrend);
  console.log(`\n=== HRV Trend ===`);
  console.log(`  Direction: ${trend.direction}`);
  console.log(`  Magnitude: ${trend.magnitude.toFixed(1)}%`);
  console.log(`  Concern: ${trend.concern ? '⚠️ YES — consider rest' : '✅ No'}`);

  // ── Training Monotony ──
  const monotony = calculateMonotony(loadTrend);
  console.log(`\n=== Training Monotony ===`);
  console.log(`  Value: ${monotony === Infinity ? '∞ (no variation)' : monotony.toFixed(2)}`);
  console.log(`  ${monotony > 2.0 ? '⚠️ Too repetitive — add variety' : '✅ Good variation'}`);

  // ── Recommendation ──
  const rec = getTrainingRecommendation({
    trainingLoad: loadTrend,
    hrvTrend,
    todayRmssd: hrvTrend.length > 0 ? hrvTrend[hrvTrend.length - 1]!.rmssd : undefined,
    baselineRmssd: hrvTrend.length > 0 ? hrvTrend[hrvTrend.length - 1]!.rollingAvg : undefined,
    maxHR: 190,
    restHR: 55,
  });
  console.log(`\n=== Training Recommendation ===`);
  console.log(`  Verdict: ${rec.verdict}`);
  console.log(`  Risk: ${rec.riskLevel}`);
  console.log(`  Prescription: Zone ${rec.prescription.primaryZone} for ${rec.prescription.suggestedDurationMin}min (max Zone ${rec.prescription.maxZone})`);
  console.log(`  Confidence: ${(rec.confidence * 100).toFixed(0)}%`);
  console.log(`  Summary: ${rec.summary}`);
  for (const r of rec.reasons) {
    console.log(`    ${r.concern ? '⚠️' : '✅'} [${r.factor}] ${r.message}`);
  }

  // ── Training Plan ──
  const plan = createWeeklyPlan('Base Building', {
    1: 'name: Easy Run\nwarmup 5m @zone 1\nwork 25m @zone 2\ncooldown 5m @zone 1',
    3: 'name: Tempo\nwarmup 10m @zone 1\nwork 20m @zone 3\ncooldown 5m @zone 1',
    5: 'name: Long Run\nwarmup 10m @zone 1\nwork 40m @zone 2\ncooldown 10m @zone 1',
  }, 4);

  const runner = new PlanRunner(plan);
  console.log(`\n=== Training Plan: ${plan.name} ===`);
  console.log(`  Blocks: ${plan.blocks.length}`);
  console.log(`  Total sessions: ${runner.currentProgress.totalPrescribed}`);

  const monday = runner.getSession(1);
  if (monday) {
    console.log(`  Monday session: ${monday.protocol?.name ?? 'parse failed'}`);
    console.log(`  DSL:\n    ${monday.dsl.split('\n').join('\n    ')}`);
  }

  console.log('\n✅ Training insights complete.');
}

main();
