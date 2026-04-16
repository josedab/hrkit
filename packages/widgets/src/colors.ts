/** Color palette for HR zones 1-5. */
export const ZONE_COLORS: Record<number, string> = {
  1: '#3b82f6',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
} as const;

/**
 * Map heart rate to a color based on percentage of maxHR.
 *
 * @param hr - Heart rate in BPM.
 * @param maxHR - Maximum heart rate.
 * @returns CSS hex color string.
 */
export function hrToColor(hr: number, maxHR: number): string {
  if (maxHR <= 0) return ZONE_COLORS[1]!;
  const pct = hr / maxHR;
  if (pct < 0.5) return '#3b82f6';
  if (pct < 0.6) return '#22c55e';
  if (pct < 0.7) return '#eab308';
  if (pct < 0.8) return '#f97316';
  if (pct < 0.9) return '#ef4444';
  return '#dc2626';
}

/**
 * Map heart rate to zone number (1-5) for color determination.
 *
 * @param hr - Heart rate in BPM.
 * @param maxHR - Maximum heart rate.
 * @returns Zone number (1-5).
 */
export function hrToZone(hr: number, maxHR: number): number {
  if (maxHR <= 0) return 1;
  const pct = hr / maxHR;
  if (pct < 0.5) return 1;
  if (pct < 0.6) return 2;
  if (pct < 0.7) return 3;
  if (pct < 0.8) return 4;
  return 5;
}
