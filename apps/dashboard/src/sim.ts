/** Tiny in-process synthetic stream so the dashboard works with no server. */

export interface SimAthlete {
  id: string;
  name: string;
  baseHr: number;
  drift: number;
}

export interface SimFrame {
  athleteId: string;
  name: string;
  hr: number;
  zone: number;
  rmssd: number;
  atl: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function zoneOf(hr: number, max = 190): number {
  const pct = hr / max;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

export function startSimulator(emit: (frame: SimFrame) => void, athletes: SimAthlete[]): () => void {
  const state = athletes.map((a) => ({
    ...a,
    hr: a.baseHr,
    rmssd: 40 + Math.random() * 20,
    atl: 30 + Math.random() * 20,
  }));
  const interval = setInterval(() => {
    for (const s of state) {
      const wobble = (Math.random() - 0.5) * 4 * s.drift;
      s.hr = clamp(s.hr + wobble, 50, 195);
      s.rmssd = clamp(s.rmssd + (Math.random() - 0.5) * 0.6, 5, 120);
      s.atl = clamp(s.atl + (Math.random() - 0.5) * 0.05, 0, 200);
      emit({ athleteId: s.id, name: s.name, hr: Math.round(s.hr), zone: zoneOf(s.hr), rmssd: s.rmssd, atl: s.atl });
    }
  }, 800);
  return () => clearInterval(interval);
}
