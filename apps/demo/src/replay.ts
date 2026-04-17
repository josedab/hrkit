interface ReplayOptions {
  onHr: (hr: number, timestamp: number) => void;
  onComplete: () => void;
}

// Sample 2-minute "easy run" trace (one HR sample per second)
const SAMPLE_HR: number[] = (() => {
  const out: number[] = [];
  for (let i = 0; i < 120; i++) {
    // ramp from 95 → 145 with mild oscillation
    const base = 95 + (i / 120) * 50;
    out.push(Math.round(base + Math.sin(i / 4) * 3));
  }
  return out;
})();

export function runReplay(opts: ReplayOptions): () => void {
  let i = 0;
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    if (i >= SAMPLE_HR.length) {
      clearInterval(timer);
      opts.onComplete();
      return;
    }
    opts.onHr(SAMPLE_HR[i]!, Date.now());
    i++;
  }, 250); // 4× speed for impatient demo viewers
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
