import type { MockFixture } from '../../mock-transport.js';

/**
 * Simulated ECG data with synthetic artifacts for testing.
 * Represents a Polar H10 ECG stream at 130Hz.
 * Each packet contains ~73 samples (roughly 0.56s per notification).
 */
export function generateECGFixture(): {
  normalSamples: number[];
  artifactSamples: number[];
} {
  // Normal sinus rhythm ECG pattern (simplified)
  // P-wave, QRS complex, T-wave repeating
  const beatPattern = [
    // Baseline
    0, 5, 10, 15, 20, 25, 30, 35, 40,
    // P-wave
    50, 70, 90, 100, 90, 70, 50,
    // PR segment
    30, 25, 20,
    // QRS complex
    -50, -200, 800, 1200, 500, -400, -100,
    // ST segment
    0, 10, 20, 30,
    // T-wave
    50, 100, 150, 180, 170, 140, 100, 60, 30, 10,
    // Return to baseline
    0, -5, 0, 5, 0,
  ];

  // Generate ~1 second of normal data (130 samples)
  const normalSamples: number[] = [];
  while (normalSamples.length < 130) {
    for (const v of beatPattern) {
      if (normalSamples.length >= 130) break;
      // Add slight noise
      normalSamples.push(v + Math.round((Math.random() - 0.5) * 10));
    }
  }

  // Generate artifact-contaminated data (motion artifact)
  const artifactSamples = [...normalSamples];
  // Inject motion artifact in the middle (large baseline wander)
  for (let i = 40; i < 90; i++) {
    if (i < artifactSamples.length) {
      artifactSamples[i] = artifactSamples[i]! + 2000 * Math.sin((i - 40) * 0.1);
    }
  }

  return { normalSamples, artifactSamples };
}

/**
 * H10 ECG stream fixture with clean and artifact-injected packets.
 */
export const ECG_FIXTURE: MockFixture = {
  device: { id: 'h10-ecg-001', name: 'Polar H10 ECG', rssi: -42 },
  packets: [
    { timestamp: 0, hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 1000, hr: 73, rrIntervals: [822], contactDetected: true },
    { timestamp: 2000, hr: 71, rrIntervals: [845], contactDetected: true },
    { timestamp: 3000, hr: 74, rrIntervals: [811], contactDetected: true },
    { timestamp: 4000, hr: 72, rrIntervals: [833], contactDetected: true },
  ],
};
