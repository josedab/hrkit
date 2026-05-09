import { bench, describe } from 'vitest';
import { filterArtifacts } from '../artifact-filter.js';
import { parseHeartRate } from '../gatt-parser.js';
import { pnn50, rmssd, sdnn } from '../hrv.js';
import { dfaAlpha1, poincare } from '../hrv-advanced.js';
import { trimp } from '../trimp.js';
import type { TimestampedHR } from '../types.js';
import { zoneDistribution } from '../zones.js';

// ── Fixture generation ──────────────────────────────────────────────────

function generateRRIntervals(n: number): number[] {
  const rr: number[] = [];
  for (let i = 0; i < n; i++) {
    // Realistic RR: 600–1000ms with slight variability
    rr.push(700 + Math.sin(i * 0.1) * 150 + (Math.random() - 0.5) * 50);
  }
  return rr;
}

function generateSamples(n: number): TimestampedHR[] {
  const samples: TimestampedHR[] = [];
  for (let i = 0; i < n; i++) {
    samples.push({ timestamp: i * 1000, hr: 60 + Math.sin(i * 0.05) * 60 });
  }
  return samples;
}

function buildGattBuffer(hr: number, rr: number[]): DataView {
  // Flags: 0x10 = RR present, 8-bit HR
  const buf = new ArrayBuffer(2 + rr.length * 2);
  const view = new DataView(buf);
  view.setUint8(0, 0x10); // flags: RR present
  view.setUint8(1, hr);
  for (let i = 0; i < rr.length; i++) {
    // Convert ms to BLE 1/1024s ticks
    view.setUint16(2 + i * 2, Math.round((rr[i]! * 1024) / 1000), true);
  }
  return view;
}

// ── Pre-generated data ──────────────────────────────────────────────────

const RR_300 = generateRRIntervals(300);
const RR_3000 = generateRRIntervals(3000);
const SAMPLES_600 = generateSamples(600);
const SAMPLES_3600 = generateSamples(3600);
const GATT_BUF = buildGattBuffer(120, [800, 810, 795]);

const ZONE_CONFIG = {
  maxHR: 185,
  restHR: 48,
  zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number],
};

const TRIMP_CONFIG = {
  maxHR: 185,
  restHR: 48,
  sex: 'neutral' as const,
};

// ── GATT Parsing ────────────────────────────────────────────────────────

describe('GATT parsing', () => {
  bench('parseHeartRate (1 packet)', () => {
    parseHeartRate(GATT_BUF, Date.now());
  });
});

// ── HRV Metrics ─────────────────────────────────────────────────────────

describe('HRV metrics (300 RR intervals)', () => {
  bench('rmssd', () => {
    rmssd(RR_300);
  });

  bench('sdnn', () => {
    sdnn(RR_300);
  });

  bench('pnn50', () => {
    pnn50(RR_300);
  });

  bench('poincareSD1SD2', () => {
    poincare(RR_300);
  });

  bench('dfaAlpha1', () => {
    dfaAlpha1(RR_300);
  });
});

describe('HRV metrics (3000 RR intervals)', () => {
  bench('rmssd', () => {
    rmssd(RR_3000);
  });

  bench('sdnn', () => {
    sdnn(RR_3000);
  });

  bench('dfaAlpha1', () => {
    dfaAlpha1(RR_3000);
  });
});

// ── TRIMP & Zones ───────────────────────────────────────────────────────

describe('TRIMP & zone distribution (10 min session)', () => {
  bench('trimp', () => {
    trimp(SAMPLES_600, TRIMP_CONFIG);
  });

  bench('zoneDistribution', () => {
    zoneDistribution(SAMPLES_600, ZONE_CONFIG);
  });
});

describe('TRIMP & zone distribution (60 min session)', () => {
  bench('trimp', () => {
    trimp(SAMPLES_3600, TRIMP_CONFIG);
  });

  bench('zoneDistribution', () => {
    zoneDistribution(SAMPLES_3600, ZONE_CONFIG);
  });
});

// ── Artifact Filter ─────────────────────────────────────────────────────

describe('artifact filter', () => {
  bench('filterArtifacts (300 RR)', () => {
    filterArtifacts(RR_300);
  });

  bench('filterArtifacts (3000 RR)', () => {
    filterArtifacts(RR_3000);
  });
});
