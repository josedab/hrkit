export type SimBrand = 'polar' | 'garmin' | 'wahoo' | 'generic';

interface SimOptions {
  onHr: (hr: number, timestamp: number) => void;
  onEcg?: (samples: number[], timestamp: number) => void;
  /** Brand-flavored profile — affects sample-rate, RR jitter, and noise floor. */
  brand?: SimBrand;
}

const BRAND_PROFILE: Record<SimBrand, { hrJitter: number; noise: number; ecgFs: number }> = {
  polar: { hrJitter: 0.6, noise: 0.02, ecgFs: 130 }, // Polar H10 PMD
  garmin: { hrJitter: 1.2, noise: 0.04, ecgFs: 0 }, // Garmin HRM-Pro: HR-only
  wahoo: { hrJitter: 1.0, noise: 0.03, ecgFs: 0 }, // Wahoo TICKR: HR-only
  generic: { hrJitter: 1.5, noise: 0.05, ecgFs: 0 },
};

// Tabata: 8 rounds of (20s work @ 170 bpm + 10s rest @ 120 bpm) — drives HR + simulated ECG
export function runSimulated(opts: SimOptions): () => void {
  const profile = BRAND_PROFILE[opts.brand ?? 'polar'];
  const start = Date.now();
  let lastHr = 75;
  let stopped = false;

  // HR ticks every 1 s, ECG ticks every 100 ms (~13 samples per tick at 130 Hz)
  const hrTimer = setInterval(() => {
    if (stopped) return;
    const t = Date.now();
    const elapsed = (t - start) / 1000;
    const cycle = elapsed % 30;
    const target = cycle < 20 ? 168 : 122;
    const drift = Math.sign(target - lastHr) * Math.min(2, Math.abs(target - lastHr));
    const jitter = (Math.random() - 0.5) * 2 * profile.hrJitter;
    lastHr = lastHr + drift + jitter;
    opts.onHr(Math.round(lastHr), t);
  }, 1000);

  let ecgTimer: ReturnType<typeof setInterval> | null = null;
  if (opts.onEcg && profile.ecgFs > 0) {
    let phase = 0;
    ecgTimer = setInterval(() => {
      if (stopped) return;
      const t = Date.now();
      const fs = profile.ecgFs;
      const samples: number[] = [];
      const period = (60 / lastHr) * fs;
      for (let i = 0; i < 13; i++) {
        const x = (phase % period) / period;
        let v = Math.sin(2 * Math.PI * x) * 0.05;
        if (x > 0.45 && x < 0.55) v += Math.sin((x - 0.5) * Math.PI * 20) * 1.2;
        if (x > 0.6 && x < 0.7) v += Math.sin((x - 0.65) * Math.PI * 10) * 0.2;
        v += (Math.random() - 0.5) * profile.noise;
        samples.push(v);
        phase++;
      }
      opts.onEcg?.(samples, t);
    }, 100);
  }

  return () => {
    stopped = true;
    clearInterval(hrTimer);
    if (ecgTimer) clearInterval(ecgTimer);
  };
}
