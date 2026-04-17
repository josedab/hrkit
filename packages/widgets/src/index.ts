import { HRKitBreathPacer } from './breath-pacer.js';
import { HRKitECGStrip } from './ecg-strip.js';
import { HRKitHeartRate } from './heart-rate.js';
import { HRKitHRChart } from './hr-chart.js';
import { HRKitZoneBar } from './zone-bar.js';

export { HRKitBreathPacer } from './breath-pacer.js';
export { hrToColor, hrToZone, ZONE_COLORS } from './colors.js';
export { HRKitECGStrip } from './ecg-strip.js';
export { HRKitHeartRate } from './heart-rate.js';
export { HRKitHRChart } from './hr-chart.js';
export type { RPeakOptions, RPeakResult } from './r-peak.js';
export { detectRPeaks } from './r-peak.js';
export { HRKitZoneBar } from './zone-bar.js';

/**
 * Register all @hrkit Web Components with the browser's custom element registry.
 * Safe to call multiple times — skips already-registered elements.
 * Called automatically on import; only call manually if using lazy loading.
 */
export function registerAll(): void {
  if (!customElements.get('hrkit-heart-rate')) {
    customElements.define('hrkit-heart-rate', HRKitHeartRate);
  }
  if (!customElements.get('hrkit-zone-bar')) {
    customElements.define('hrkit-zone-bar', HRKitZoneBar);
  }
  if (!customElements.get('hrkit-hr-chart')) {
    customElements.define('hrkit-hr-chart', HRKitHRChart);
  }
  if (!customElements.get('hrkit-ecg-strip')) {
    customElements.define('hrkit-ecg-strip', HRKitECGStrip);
  }
  if (!customElements.get('hrkit-breath-pacer')) {
    customElements.define('hrkit-breath-pacer', HRKitBreathPacer);
  }
}

// Auto-register when imported
registerAll();
